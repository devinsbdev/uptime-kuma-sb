// const { R } = require("redbean-node");
const { R } = require("../server/modules/redbean-node/dist/redbean-node");

class TwoFA {

    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(userID) {
        return await R.exec("UPDATE ?? SET ?? = ? WHERE ?? = ? ", [
            'user',
            'twofa_status',
            0,
            'id',
            userID,
        ]);
    }

}

module.exports = TwoFA;
