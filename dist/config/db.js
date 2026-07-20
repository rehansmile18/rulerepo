"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = connectDb;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
async function connectDb() {
    mongoose_1.default.set("strictQuery", true);
    return mongoose_1.default.connect(env_1.env.mongoUri);
}
//# sourceMappingURL=db.js.map