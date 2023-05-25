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
            host: process.env.TEST_SMTP_SERVER,
            port: process.env.TEST_SMTP_SERVER_PORT
        });

        const response = await smtpClient.sendMail({
            from: 'example@example.com',
            to: process.env.TEST_MAILBOX,
            subject: 'hi from nodemailer',
            html: '<h1>hi_there - im async test() </h1>'
        });
        log.debug("Response", response);
    }
}

module.exports = SmtpPlugin;
