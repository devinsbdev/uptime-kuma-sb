const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const { nanoid } = require("nanoid");
const passwordHash = require("../password-hash");
const apicache = require("../modules/apicache");
const APIKey = require("../model/api_key");
const { Settings } = require("../settings");
const { sendAPIKeyList } = require("../client");

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 */
module.exports.apiKeySocketHandler = (socket) => {
    // Add a new api key
    socket.on("addAPIKey", async (key, callback) => {
        try {
            checkLogin(socket);

            let clearKey = nanoid(40);
            let hashedKey = passwordHash.generate(clearKey);
            key["key"] = hashedKey;
            let bean = await APIKey.save(key, socket.userID);

            log.debug("apikeys", "Added API Key");
            log.debug("apikeys", key);

            // Append key ID and prefix to start of key seperated by _, used to get
            // correct hash when validating key.
            let formattedKey = "uk" + bean.id + "_" + clearKey;
            await sendAPIKeyList(socket);

            // Enable API auth if the user creates a key, otherwise only basic
            // auth will be used for API.
            await Settings.set("apiKeysEnabled", true);

            callback({
                ok: true,
                msg: "Added Successfully.",
                key: formattedKey,
                keyID: bean.id,
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getAPIKeyList", async (callback) => {
        try {
            checkLogin(socket);
            await sendAPIKeyList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Deleted API Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("DELETE FROM ?? WHERE ?? = ? AND ?? = ? ", [
                'api_key',
                'id',
                keyID,
                'user_id',
                socket.userID
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Deleted Successfully.",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("disableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Disabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE ?? SET ?? = ? WHERE ?? = ? ", [
                'api_key',
                'active',
                'false',
                'id',
                keyID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Disabled Successfully.",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("enableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Enabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE ?? SET ?? = ? WHERE ?? = ? ", [
                'api_key',
                'active',
                'true',
                'id',
                keyID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Enabled Successfully",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
