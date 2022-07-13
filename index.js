async function main() {
    try {
        let snowStatus = "initial";
        let msTime = 0;
        do {
            msTime = msTime +  5000;
            console.log(`MS time: ${msTime} and snow status: ${snowStatus}`);
            if(msTime === 20000) {
                snowStatus = "approved";
                console.log(`MS time: ${msTime} and snow status: ${snowStatus}`);
            }
            await sleep(5000);
        } while (snowStatus !== "approved");
    } catch (error) {
        console.log(error.message);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();