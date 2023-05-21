const { checkLogin } = require("../util-server");
const Database = require("../database_new");
// const Database = require("../database");

/**
 * Handlers for database
 * @param {Socket} socket Socket.io instance
 */
module.exports = (socket) => {

    // Post or edit incident
    socket.on("getDatabaseSize", async (callback) => {
        try {
            checkLogin(socket);
            callback({
                ok: true,
                size: await Database.getSize('all'),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("shrinkDatabase", async (callback) => {
        try {
            checkLogin(socket);
            await Database.shrinkFull();
            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
