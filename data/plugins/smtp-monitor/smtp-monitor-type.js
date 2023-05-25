const { MonitorType } = require("../../../server/monitor-types/monitor-type");
const { GraphClient, TestMessage } = require("./services/graph_client.js");
const { UP, sleep } = require("../../../src/util"); // DOWN, PENDING
const nodemailer = require("nodemailer");
const dayjs = require("dayjs");
const config = require(`./services/AAD.json`);

class SmtpMonitorType extends MonitorType {

    name = "smtp";

    /**
     *
     * @type {Smtp}
     */
    smtpClient = null;

    async check(monitor, heartbeat) {
        // fetch nodemailer instance
        const smtpClient = await this.getSmtpClient(monitor);

        // mark header with this timestamp
        let startTime = dayjs().valueOf();

        // send the test message
        const smtp_response = await smtpClient.sendMail({
            from: monitor.smtpfrom,
            to: monitor.smtpto,
            subject: monitor.name + ' - hi from nodemailer',
            html: `<h1>hi there! i am a ${monitor.type} monitor.</h1>`,
            headers: {
                'x-sent-at': startTime
            }
        });

        console.debug(`Closing SMTP client connection to ${monitor.name}`);
        await smtpClient.close();

        // monitor is down if no 250 OK
        if ((smtp_response.response).match('^250')) {
            console.log('proceed');
        } else {
            throw new Error(smtp_response.error);
        }

        // we'll call graph below to see if the message arrived
        let graph_client = new GraphClient(config);
        if (!(await graph_client.fetchClientCreds())) {
            throw new Error('something is up with ur azure token bro, goaway');
        }

        let testMsg = undefined;
        let elapsed_secs = 0;
        while (testMsg === undefined) {
            elapsed_secs = ((dayjs().valueOf() - startTime) / 1000);
            if (elapsed_secs > 240) { // 4 min timeout
                throw new Error(`Timed out waiting for test message ${startTime} to arrive. SMTP response was: ${smtp_response.response}`);
            }
            // lets not completely hammer msgraph ok guys
            await sleep(2000);
            // console.debug(`Checking for a matching 'x-sent-at' header ...`)
            testMsg = await this.checkMessages(graph_client, startTime);
        }

        // 'ping' will be latency displayed on dash, so this should be
        // total elapsed from startTime to receipt timestamp in header
        let ping = testMsg.messageReceiptTs - startTime;
        console.debug(`${monitor.name} delay: ${ping}ms`);

        // if everything worked out then we'll have an 'accepted' response
        // and ping will be a positive integer (unit: ms)
        if (smtp_response.accepted.length >= 1 && ping > 0) {
            monitor.last_result = heartbeat.msg = `${dayjs().toDate()} | ${testMsg.internetMessageId} | ${smtp_response.response}`;
            heartbeat.status = UP;
            heartbeat.ping = ping;
        } else {
            throw new Error(`Test message failed: Stdout: ${smtp_response.respose}; Stderr: ${smtp_response.error}`);
            // monitor.last_result = heartbeat.msg = `${dayjs().toDate()} | ${smtp_response.response} | ${smtp_response.error}`
            // heartbeat.status = DOWN;
        }
    }

    async checkMessages(graph_client, startTime) {
        // ideally we return this with the test message properties pulled from graph api
        let messageIWant;

        const mail_user_id = process.env.TEST_MAILBOX;
        const graph_uri = `users/${mail_user_id}/messages?$select=internetMessageId,` +
            `internetMessageHeaders,receivedDateTime,sentDateTime`;
        let headers = {
            'Accept': 'application/json',
            'User-Agent': 'Uptime-Smtp-Checker'
        };

        messageIWant = await graph_client.doApiCall(graph_uri, 'GET', headers).then( async (d) => {

            // filter for messages that match our 'x-sent-at' header
            let yaThatOne = ( d.data.value.filter( res => res.internetMessageHeaders
                .find( header => header.value === startTime.toString())) )[0];

            if (yaThatOne !== undefined) {
                console.log('... jackpot.');

                // scrape the properties we want
                const interMsgId = yaThatOne.internetMessageId;
                let messageId = yaThatOne.id;
                let messageReceiptTs = dayjs(yaThatOne.receivedDateTime).toDate().valueOf();
                let messageSentTs = dayjs(yaThatOne.sentDateTime).toDate().valueOf();
                let msg_uri = `users/${mail_user_id}/messages/${messageId}`;

                // remove test message from 365 mailbox
                await graph_client.doApiCall(msg_uri, 'DELETE', headers).then((dr) => {
                    if (dr.status === 204) {
                        console.log("Deleted test message from mailbox.");
                    }
                });

                // msg found; return msg object with some relevant props
                return new TestMessage(messageId, messageReceiptTs,
                    messageSentTs, interMsgId);
            }
            // msg not found yet; we'll be back
        });

        return messageIWant;
    }

    async getSmtpClient(monitor) {
        return await this.getSmtpTransport(monitor);
    }

    getSmtpTransport(monitor) {
        let smtp_params = {
            host: monitor.hostname,
            port: monitor.port,
            secure: false,
        };

        // only use 'secure' for SMTPS;
        // upgrade later with STARTTLS if port = 587
        if (monitor.port === 465) {
            smtp_params.secure = true;
        }

        // if not relaying there will be credentials on the monitor object
        if (monitor.basic_auth_user && monitor.basic_auth_pass) {
            smtp_params.auth = {
                user: monitor.basic_auth_user,
                pass: monitor.basic_auth_pass,
                type: 'PLAIN'
            };
        }

        this.smtpClient = nodemailer.createTransport(smtp_params);
        return this.smtpClient;
    }

    async close() {
        if (this.smtpClient) {
            this.smtpClient.close();
        }
    }
}

module.exports = {
    SmtpMonitorType,
};
