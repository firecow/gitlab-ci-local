import {Utils} from "./utils";


(async () => {
    // const imagePlusTag = "docker/whalesay\n:latest";
    console.log("Pulling Image");
    return Utils.spawn(`docker pull docker/whalesay`, {shell: true})


    console.log("done")
})()
