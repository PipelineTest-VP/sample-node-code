const axios = require("axios");

async function main() {
    const url = "https://reqres.in/api/users/2";
    const response = await axios.get(url);
    console.log(response.data.data);
}

main();