const ws = require("ws");
const EventEmitter = require("events");

const INTERNAL = "internal";
const PREFIX = "GS:";

const IMSG = {
    JOIN: PREFIX + "JOIN",
    LEAVE: PREFIX + "LEAVE",
    CREATE: PREFIX + "CREATE",
    DELETE: PREFIX + "DELETE",
    BROADCAST: PREFIX + "BROADCAST"
};

const RG_PREFIX = "RGS:";
const RG_IMSG = {
    BROADCAST: RG_PREFIX + "BROADCAST",
    SEARCH: RG_PREFIX + "SEARCH",
    LEAVE: RG_PREFIX + "LEAVE",
    CONFIRM: RG_PREFIX + "CONFIRM",
    DISBAND: RG_PREFIX + "DISBAND", //emtted by server only
    START: RG_PREFIX + "START", //emtted by server only
    END: RG_PREFIX + "END", //emtted by server only

    //client state related
    STATE_UPDATE: RG_PREFIX + "STATE",
    MESSAGE_UPDATE: RG_PREFIX + "MESSAGE",
    WORLD_UPDATE: RG_PREFIX + "WORLD"
};

/**
 * although this client works quite well, it is not designed to be used for anything else
 * than testing
 */
class Client extends EventEmitter {

    constructor({host, port, log}){
        super();
        this.conStr = `ws://${host}:${port}`;
        this.socket = null;
        this._log = log;

        this.Group = this._getGroupOptions();
        this.Room = this._getRoomOptions();

        this.IMSG = IMSG;
        this.RG_IMSG = RG_IMSG;
    }

    log(message){

        if(!this._log){
            return;
        }

        this._log(message);
    }

    open(){
        return new Promise((resolve, reject) => {

            this.socket = new ws(this.conStr);
            this.socket.on("open", () => {
                this.log("connection open.");
                resolve(true);
            });
            this._attachInternalListeners();
        });
    }

    send(type, message, header = false){
        return this._sendPromise(Client._getJOS(type, message, header));
    }

    _getRoomOptions() {

        const options = {};

        options.search = () => {
            return this._sendInternal({}, RG_IMSG.SEARCH);
        };

        options.broadcast = message => {
            return this._sendInternal({
                delivery: message
            }, RG_IMSG.BROADCAST);
        };

        options.leave = () => {
            return this._sendInternal({}, RG_IMSG.LEAVE);
        };

        options.confirm = (matchId) => {
            return this._sendInternal({
                matchId
            }, RG_IMSG.CONFIRM);
        };

        options.stateUpdate = (state) => {
            return this._sendInternal({
                state
            }, RG_IMSG.STATE_UPDATE);
        };

        return options;
    }

    _getGroupOptions() {

        const options = {};

        options.join = (groupId) => {
            return this._sendInternal({
                groupId
            }, IMSG.JOIN);
        };

        options.leave = (groupId) => {
            return this._sendInternal({
                groupId
            }, IMSG.LEAVE);
        };

        options.create = () => {
            return this._sendInternal({},  IMSG.CREATE);
        };

        options.delete = (groupId) => {
            return this._sendInternal({
                groupId
            }, IMSG.DELETE);
        };

        options.broadcast = (groupId, message) => {
            return this._sendInternal({
                groupId,
                delivery: message
            }, IMSG.BROADCAST);
        };

        return options;
    }

    _sendInternal(message, header){

        if(typeof header !== "string"){
            return Promise.reject(new Error("send internal requires a header."));
        }

        return this._sendPromise(Client._getJOS(INTERNAL, message, header));
    }

    close(){
        this.socket.close();
    }

    static getVector(x, y, z){
        return {
            x,
            y,
            z
        };
    }

    static buildState(position, rotation, animations){
        return {
            position,
            rotation,
            animations
        };
    }

    _sendPromise(data){
        return new Promise((resolve, reject) => {

            if(typeof data !== "string"){
                data = JSON.stringify(data);
            }

            this.socket.send(data, (error, result) => {

                if(error){
                    this.log(error.message);
                    return reject(error);
                }

                resolve(result);
            });
        });
    }

    _attachInternalListeners(){

        this.socket.on("message", message => {
            super.emit("message", message);

            let jmessage = null;
            try {
                jmessage = JSON.parse(message);
            } catch(e){
                this.log("failed to parse json message: " + message);
            }

            if(jmessage){
                super.emit("jmessage", jmessage);
                return;
            }

            this.log("message was empty.");
        });

        this.socket.on("error", error => {
            this.log(error.message);
            super.emit("error", error);
        });

        this.socket.on("close", () => {
            this.log("connection closed.");
            super.emit("close");
        });
    }

    static _getJOS(type, content, header){

        if(!header) {
            return JSON.stringify({
                type,
                content
            });
        }

        return JSON.stringify({
            type,
            header,
            content
        });
    }
}

module.exports = Client;
