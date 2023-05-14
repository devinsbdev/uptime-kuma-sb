var msal = require('@azure/msal-node');
const { default: axios } = require('axios');

class GraphClient {
    constructor (conf) {
        this.clientConfig = {
            auth: conf.authOptions
        };
        this.accessToken;
        this.baseUrl = 'https://graph.microsoft.com/v1.0'
        this.confidentialClientApplication = new msal.ConfidentialClientApplication(this.clientConfig);
        this.graphAppScope = ["https://graph.microsoft.com/.default"]
    }

    async fetchClientCreds() {
        var tokenResponse = await this.getClientCredentialsToken(this.confidentialClientApplication, this.graphAppScope);
        if (tokenResponse !== undefined) {
            this.accessToken = tokenResponse.accessToken;
            return true;
        }
        return false;
    }

    getClientCredentialsToken(cca, clientCredentialRequestScopes, ro) {
        const clientCredentialRequest = {
            scopes: clientCredentialRequestScopes,
            skipCache: false, // if true, skips the cache and forces MSAL to get a new token from Azure AD
        };
    
        return cca.acquireTokenByClientCredential(clientCredentialRequest)
    }

    async doApiCall(uri, method, headers, payload) {
        var full_url = `${this.baseUrl}/${uri}`;
        var bear = "Bearer " + this.accessToken;
        headers['Authorization'] = bear;
        
        const options = {
            url: full_url,
            method: method,
            headers: headers
        }

        return await axios.request(options)
    }

}

class TestMessage {
    constructor (msgId, receivedTs, sentTs, interMsgId) {
        this.messageId = msgId;
        this.messageReceiptTs = receivedTs;
        this.messageSentTs = sentTs;
        this.internetMessageId = interMsgId
    }
}

module.exports = {
    TestMessage,
    GraphClient
}