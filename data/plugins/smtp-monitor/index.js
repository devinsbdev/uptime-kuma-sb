const { log } = require("../../../src/util");
const { Plugin } = require("../../../server/plugin");
const { SmtpMonitorType } = require("./smtp-monitor-type");
const nodemailer = require('nodemailer');

class SmtpPlugin extends Plugin {

    /**
     *
     * @type {SmtpMonitorType}
     */
    smtpMonitorType = null;

    /**
     *
     * @type {UptimeKumaServer}
     */
    server = null;

    /**
     *
     * @param {UptimeKumaServer} server
     */
    constructor(server) {
        super();
        this.server = server;
        log.debug("RBM", "Current plugin folder: " + __dirname);
        this.SmtpMonitorType = new SmtpMonitorType();
        server.addMonitorType(this.SmtpMonitorType);
    }

    async unload() {
        if (this.SmtpMonitorType) {
            await this.SmtpMonitorType.close();
            this.server.removeMonitorType(this.SmtpMonitorType);
        }
    }

    async test() {
        const smtpClient = nodemailer.createTransport({
                host: 'smtp.example.com',
                port: 25
            });

        const response = await smtpClient.sendMail({
            from: 'example@example.com',
            to: 'example@example.com',
            subject: 'hi from node',
            html: '<h1>wowwwhithere - test() async</h1>'
        });
        log.debug("Response", response)
    }
}

module.exports = SmtpPlugin;
