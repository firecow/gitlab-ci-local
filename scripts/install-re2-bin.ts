import yargs from "yargs";
import https from "https";
import zlib from "zlib";
import fs from "fs-extra";
import {promisify} from "util";
import path from "path";
import assert from "assert";

const artifactPath = "./node_modules/re2/build/Release/re2.node";

const downloadFile = (url: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        let buffer: Buffer;
        https
            .get(url, (response) => {
                const statusCode = response.statusCode;
                assert(statusCode);
                if (statusCode >= 300 && statusCode < 400 && response.headers && response.headers.location) {
                    downloadFile(response.headers.location).then(resolve, reject);
                    return;
                }
                if (response.statusCode != 200) {
                    reject(Error(`Status ${response.statusCode} for ${url}`));
                    return;
                }
                response.on("data", data => {
                    if (buffer) {
                        buffer = Buffer.concat([buffer, data]);
                    } else {
                        buffer = data;
                    }
                });
                response.on("end", () => resolve(buffer));
            })
            .on("error", e => reject(e))
            .end();
    });
};

const write = async (name: string, data: Buffer) => {
    await fs.mkdir(path.dirname(name), {recursive: true});
    await fs.writeFile(name, data);
};

const main = async () => {
    const yparser = yargs(process.argv.slice(2));
    const argv = await yparser
        .option("platform", {
            type: "string",
            choices: ["darwin", "linux", "win32"],
            demandOption: true,
        })
        .option("platformArch", {
            type: "string",
            choices: ["x64", "arm64"],
            demandOption: true,
        })
        .option("platformABI", {
            type: "string",
            choices: ["127", "115"],
            default: "127",
            demandOption: true,
        })
        .argv;

    const {platform, platformArch, platformABI} = argv;
    const re2Version = JSON.parse(fs.readFileSync("./node_modules/re2/package.json", "utf8")).version;
    const url = `https://github.com/uhop/node-re2/releases/download/${re2Version}/${platform}-${platformArch}-${platformABI}.gz`;

    const artifact = await downloadFile(url);
    console.log(`Patching ${artifactPath} with ${platform}-${platformArch}-${platformABI} ...`);
    await write(artifactPath, await promisify(zlib.gunzip)(artifact));
};

await main();
