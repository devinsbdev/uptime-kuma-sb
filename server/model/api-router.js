let express = require("express");
const { allowDevAllOrigin, allowAllOrigin, percentageToColor, filterAndJoin, sendHttpError } = require("../util-server");
// const { R } = require("redbean-node");
const { R } = require("../modules/redbean-node/dist/redbean-node");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING, flipStatus, log } = require("../../src/util");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { UptimeCacheList } = require("../uptime-cache-list");
const { makeBadge } = require("badge-maker");
const { badgeConstants } = require("../config");
const { Prometheus } = require("../prometheus");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

router.get("/api/entry-page", async (request, response) => {
    allowDevAllOrigin(response);

    let result = { };

    if (request.hostname in StatusPage.domainMappingList) {
        result.type = "statusPageMatchedDomain";
        result.statusPageSlug = StatusPage.domainMappingList[request.hostname];
    } else {
        result.type = "entryPage";
        result.entryPage = server.entryPage;
    }
    response.json(result);
});

router.get("/api/push/:pushToken", async (request, response) => {
    try {

        let pushToken = request.params.pushToken;
        let msg = request.query.msg || "OK";
        let ping = parseInt(request.query.ping) || null;
        let statusString = request.query.status || "up";
        let status = (statusString === "up") ? UP : DOWN;

        let monitor = await R.findOne("monitor", " ?? = ? AND ?? = ? ", [
            'push_token',
            pushToken,
            'active',
            'true'
        ]);

        if (! monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await Monitor.getPreviousHeartbeat(monitor.id);

        if (monitor.isUpsideDown()) {
            status = flipStatus(status);
        }

        let isFirstBeat = true;
        let previousStatus = status;
        let duration = 0;

        let bean = R.dispense("heartbeat");
        bean.time = R.isoDateTimeMillis(dayjs.utc());

        if (previousHeartbeat) {
            isFirstBeat = false;
            previousStatus = previousHeartbeat.status;
            duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

        if (await Monitor.isUnderMaintenance(monitor.id)) {
            msg = "Monitor under maintenance";
            status = MAINTENANCE;
        }

        log.debug("router", `/api/push/ called at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`);
        log.debug("router", "PreviousStatus: " + previousStatus);
        log.debug("router", "Current Status: " + status);

        bean.important = Monitor.isImportantBeat(isFirstBeat, previousStatus, status);
        bean.monitor_id = monitor.id;
        bean.status = status;
        bean.msg = msg;
        bean.ping = ping;
        bean.duration = duration;

        await R.store(bean);

        io.to(monitor.user_id).emit("heartbeat", bean.toJSON());
        UptimeCacheList.clearCache(monitor.id);
        Monitor.sendStats(io, monitor.id, monitor.user_id);
        new Prometheus(monitor).update(bean, undefined);

        response.json({
            ok: true,
        });

        if (Monitor.isImportantForNotification(isFirstBeat, previousStatus, status)) {
            await Monitor.sendNotification(isFirstBeat, monitor, bean);
        }

    } catch (e) {
        response.status(404).json({
            ok: false,
            msg: e.message
        });
    }
});

router.get("/api/badge/:id/status", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        upLabel = "Up",
        downLabel = "Down",
        pendingLabel = "Pending",
        maintenanceLabel = "Maintenance",
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        pendingColor = badgeConstants.defaultPendingColor,
        maintenanceColor = badgeConstants.defaultMaintenanceColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        const overrideValue = value !== undefined ? parseInt(value) : undefined;

        let publicMonitor = await R.getRow(`
                SELECT monitor_group.monitor_id FROM monitor_group, ??
                WHERE monitor_group.group_id = ??.id
                AND monitor_group.monitor_id = ?
                AND public = true
            `,
        [ 'group', 'group', requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(requestedMonitorId);
            const state = overrideValue !== undefined ? overrideValue : heartbeat.status;

            if (label === undefined) {
                badgeValues.label = "Status";
            } else {
                badgeValues.label = label;
            }
            switch (state) {
                case DOWN:
                    badgeValues.color = downColor;
                    badgeValues.message = downLabel;
                    break;
                case UP:
                    badgeValues.color = upColor;
                    badgeValues.message = upLabel;
                    break;
                case PENDING:
                    badgeValues.color = pendingColor;
                    badgeValues.message = pendingLabel;
                    break;
                case MAINTENANCE:
                    badgeValues.color = maintenanceColor;
                    badgeValues.message = maintenanceLabel;
                    break;
                default:
                    badgeValues.color = badgeConstants.naColor;
                    badgeValues.message = "N/A";
            }
        }

        // build the svg based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/uptime/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultUptimeLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultUptimeValueSuffix,
        color,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        // if no duration is given, set value to 24 (h)
        const requestedDuration = request.params.duration !== undefined ? parseInt(request.params.duration, 10) : 24;
        const overrideValue = value && parseFloat(value);

        let publicMonitor = await R.getRow(`
                SELECT monitor_group.monitor_id FROM monitor_group, ??
                WHERE monitor_group.group_id = ??.id
                AND monitor_group.monitor_id = ?
                AND public = true
            `,
        [ 'group', 'group', requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptime = overrideValue ?? await Monitor.calcUptime(
                requestedDuration,
                requestedMonitorId
            );

            // limit the displayed uptime percentage to four (two, when displayed as percent) decimal digits
            const cleanUptime = (uptime * 100).toPrecision(4);

            // use a given, custom color or calculate one based on the uptime value
            badgeValues.color = color ?? percentageToColor(uptime);
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Uptime (${requestedDuration}${labelSuffix})`,
            ]);
            badgeValues.message = filterAndJoin([ prefix, cleanUptime, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/ping/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultPingLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        const requestedDuration = Math.min(request.params.duration ? parseInt(request.params.duration, 10) : 24, 720);
        const overrideValue = value && parseFloat(value);

        const publicAvgPing = parseInt(await R.getCell(`
                SELECT AVG(ping) FROM heartbeat, ??,monitor_group
                WHERE monitor_group.group_id = ??.id
                AND heartbeat.time > ??
                AND heartbeat.ping IS NOT NULL
                AND public = true
                AND heartbeat.monitor_id = ?
            `,
        [ 'group', 'group', requestedDuration, requestedMonitorId ],
        false
        ));
        // [ -requestedDuration, requestedMonitorId ],

        const badgeValues = { style };

        if (!publicAvgPing) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPing = parseInt(overrideValue ?? publicAvgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a lable string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([ labelPrefix, label ?? `Avg. Ping (${requestedDuration}${labelSuffix})` ]);
            badgeValues.message = filterAndJoin([ prefix, avgPing, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/avg-response/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        const requestedDuration = Math.min(
            request.params.duration
                ? parseInt(request.params.duration, 10)
                : 24,
            720
        );
        const overrideValue = value && parseFloat(value);

        const publicAvgPing = parseInt(await R.getCell(`
            SELECT AVG(ping) FROM monitor_group, \`group\`, heartbeat
            WHERE monitor_group.group_id = \`group\`.id
            AND heartbeat.time > (TIMESTAMPTZ((NOW() - interval '${requestedDuration} hours')::timestamp))
            AND heartbeat.ping IS NOT NULL
            AND public = true
            AND heartbeat.monitor_id = ?
            `,
        [ requestedMonitorId ],
        false
        ));
        // [ -requestedDu ration, requestedMonitorId ],

        const badgeValues = { style };

        if (!publicAvgPing) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPing = parseInt(overrideValue ?? publicAvgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Response (${requestedDuration}h)`,
                labelSuffix,
            ]);
            badgeValues.message = filterAndJoin([ prefix, avgPing, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/cert-exp", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const date = request.query.date;

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = date ? "" : badgeConstants.defaultCertExpValueSuffix,
        upColor = badgeConstants.defaultUpColor,
        warnColor = badgeConstants.defaultWarnColor,
        downColor = badgeConstants.defaultDownColor,
        warnDays = badgeConstants.defaultCertExpireWarnDays,
        downDays = badgeConstants.defaultCertExpireDownDays,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        const overrideValue = value && parseFloat(value);

        let publicMonitor = await R.getRow(`
            SELECT monitor_group.monitor_id FROM monitor_group, ??
            WHERE monitor_group.group_id = ??.id
            AND monitor_group.monitor_id = ?
            AND public = 1
            `,
        [ 'group', 'group', requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const tlsInfoBean = await R.findOne("monitor_tls_info", "?? = ?", [
                'monitor_id',
                requestedMonitorId,
            ]);

            if (!tlsInfoBean) {
                // return a "No/Bad Cert" badge in naColor (grey), if no cert saved (does not save bad certs?)
                badgeValues.message = "No/Bad Cert";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const tlsInfo = JSON.parse(tlsInfoBean.info_json);

                if (!tlsInfo.valid) {
                    // return a "Bad Cert" badge in naColor (grey), when cert is not valid
                    badgeValues.message = "Bad Cert";
                    badgeValues.color = badgeConstants.downColor;
                } else {
                    const daysRemaining = parseInt(overrideValue ?? tlsInfo.certInfo.daysRemaining);

                    if (daysRemaining > warnDays) {
                        badgeValues.color = upColor;
                    } else if (daysRemaining > downDays) {
                        badgeValues.color = warnColor;
                    } else {
                        badgeValues.color = downColor;
                    }
                    // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                    badgeValues.labelColor = labelColor ?? "";
                    // build a label string. If a custom label is given, override the default one
                    badgeValues.label = filterAndJoin([
                        labelPrefix,
                        label ?? "Cert Exp.",
                        labelSuffix,
                    ]);
                    badgeValues.message = filterAndJoin([ prefix, date ? tlsInfo.certInfo.validTo : daysRemaining, suffix ]);
                }
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/response", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        const overrideValue = value && parseFloat(value);

        let publicMonitor = await R.getRow(`
            SELECT monitor_group.monitor_id FROM monitor_group, ??
            WHERE monitor_group.group_id = ??.id
            AND monitor_group.monitor_id = ?
            AND public = 1
            `,
        [ 'group', 'group', requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(
                requestedMonitorId
            );

            if (!heartbeat.ping) {
                // return a "N/A" badge in naColor (grey), if previous heartbeat has no ping

                badgeValues.message = "N/A";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const ping = parseInt(overrideValue ?? heartbeat.ping);

                badgeValues.color = color;
                // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                badgeValues.labelColor = labelColor ?? "";
                // build a label string. If a custom label is given, override the default one
                badgeValues.label = filterAndJoin([
                    labelPrefix,
                    label ?? "Response",
                    labelSuffix,
                ]);
                badgeValues.message = filterAndJoin([ prefix, ping, suffix ]);
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.post("/api/add-monitor", async (request, response) => {
    allowAllOrigin(response);

    /** Invoke-WebRequest -Uri http://localhost:3001/api/add-monitor -Method Post -Credential $cred -Authentication Basic -AllowUnencryptedAuthentication -Headers @{Accept='application/json';'Content-Type'='application/json'} -Body $(@{name='devin-mon-9';type='http';url='https://google.com';description='a monitor ok great yaya'; tags=@(@{name="http"; value=""}, @{name='client'; value="google"})} | ConvertTo-Json) */

    // "Content-Type": "application/json"
    const {
        name,
        type,
        url,
        description,
        tags
    } = request.body;

    if (type !== 'http') {
        log.error("api-router", `Adding ${type} monitor type via API is not yet supported.`);
        response.status(405);
        return response.send(`Adding ${type} monitor type via API is not yet supported.`);
    }

    if (!name || !url) {
        log.error("api-router", `'name' and 'url' fields are mandatory`);
        response.status(405);
        return response.send(`'name' and 'url' fields are mandatory`);
    }

    let my_tags = [];
    if (tags) {
        for (let index = 0; index < tags.length; index++) {
            let a_tag;
            const elem = tags[index];
            if (! elem.name) {
                log.error("api-router", `Invalid tag format passed in POST request: ${tags}`);
                response.status(400);
                return response.send('Incorrect tag input format.');
            }

            let mt = R.dispense("tag");
            let et = await R.find("tag", "name = ?", [ elem.name ]);

            if (et.length === 0) {
                a_tag = {
                    name: elem.name,
                };

                let hex;
                switch (elem.name) {
                    case "client":
                        hex = '#013c29';
                        break;
                    default:
                        hex = '#939393';
                }
                a_tag['color'] = hex;

                mt.import(a_tag);
                await R.store(mt);
            } else {
                mt = et[0];
            }

            my_tags.push({
                tagbb: mt,
                value: elem.value
            });
        }
    }

    let monitor = {
        type: type,
        name: name,
        url: url,
        description: description,
        user_id: 1,
        method: "GET",
        interval: 60,
        retryInterval: 60,
        resendInterval: 0,
        maxretries: 1,
        notificationIDList: {},
        ignoreTls: false,
        upsideDown: false,
        packetSize: 56,
        expiryNotification: true,
        maxredirects: 10,
        accepted_statuscodes: [ "200-299" ],
        dns_resolve_type: "A",
        dns_resolve_server: "1.1.1.1",
        docker_container: "",
        docker_host: null,
        proxyId: null,
        mqttUsername: "",
        mqttPassword: "",
        mqttTopic: "",
        mqttSuccessMessage: "",
        authMethod: null,
        httpBodyEncoding: "json"
    };

    let notificationIDList = monitor.notificationIDList;
    delete monitor.notificationIDList;

    monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
    delete monitor.accepted_statuscodes;

    // validate and store new monitor
    let bean = R.dispense("monitor");
    try {
        bean.import(monitor);
        bean.validate();
        await R.store(bean);
    } catch (err) {
        log.error("api-router", err.message);
        response.status(400);
        return response.send(JSON.stringify({ "Result": `${err.message}` }));
    }

    // update notify relation and start monitor
    try {
        await updateMonitorNotification(bean.id, notificationIDList);
        await startMonitor(bean.user_id, bean.id);
    } catch (err) {
        log.error("api-router", err.message);
    }

    monitor.id = bean.id;
    log.info("monitor", `Added Monitor: ${monitor.id} via API call`);

    for (let taggy of my_tags) {
        let mtt = R.dispense("monitor_tag");
        mtt.import({
            monitor_id: monitor.id,
            tag_id: taggy.tagbb.id,
            value: taggy.value || "",
        });
        await R.store(mtt);
    }

    let savedMonitor = await R.find(
        "monitor", "?? = ? AND ?? = ?", [ 'name', monitor.name, 'id', monitor.id ]);
    if (savedMonitor.length > 0) {
        response.status(201);
        response.send(JSON.stringify({ 'Result': `Monitor ${monitor.id} created.` }));
    } else {
        response.status(400);
        response.send(JSON.stringify({ 'Result': `New monitor not found..` }));
    }
});

/**
 * Start the specified monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function startMonitor(userID, monitorID) {
    log.info("manage", `Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE  ?? SET ?? = ? WHERE ?? = ? AND ?? = ? ", [
        'monitor',
        'active',
        'true',
        'id',
        monitorID,
        'user_id',
        userID,
    ]);

    let monitor = await R.findOne("monitor", " ?? = ? ", [
        'id',
        monitorID,
    ]);

    if (monitor.id in server.monitorList) {
        server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    monitor.start(io);
}

/* * Update notifications for a given monitor
 * @param {number} monitorID ID of monitor to update
 * @param {number[]} notificationIDList List of new notification
 * providers to add
 * @returns {Promise<void>}
 */
async function updateMonitorNotification(monitorID, notificationIDList) {
    await R.exec("DELETE FROM ?? WHERE ?? = ? ", [
        'monitor_notification',
        'monitor_id',
        monitorID,
    ]);

    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

module.exports = router;
