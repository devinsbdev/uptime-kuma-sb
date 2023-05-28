// const { BeanModel } = require("redbean-node/dist/bean-model");
const { BeanModel } = require("../modules/redbean-node/dist/bean-model");

class Proxy extends BeanModel {
    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            userId: this._user_id,
            protocol: this._protocol,
            host: this._host,
            port: this._port,
            auth: !!this._auth,
            username: this._username,
            password: this._password,
            active: !!this._active,
            default: !!this._default,
            createdDate: this._created_date,
        };
    }
}

module.exports = Proxy;
