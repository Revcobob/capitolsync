// Example of how to run the actor using Apify API

const runActor = async () => {
    // Replace these with your actual values
    const APIFY_TOKEN = 'your_apify_token';
    const ACTOR_ID = 'your_actor_id'; // This will be assigned once you create the actor

    // Prepare the actor input
    const input = {
        "ftpServer": "ftp.legis.state.tx.us",
        "username": "anonymous",
        "password": "",
        "basePath": "/bills/87R",
        "fileExtensions": [".html", ".pdf", ".txt"],
        "maxDepth": 5,
        "maxFiles": 5000,
        "extractText": true,
        "directoryPatterns": [
            "/bills/87R/billtext/*"
        ],
        "filePatterns": [
            "HB.*", 
            "SB.*"
        ]
    };

    // API call to run the actor
    const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
            memory: 4096,
            timeout: 600, // 10 minutes
            input
        })
    });

    const data = await response.json();
    console.log('Actor run started:', data);
    console.log(`To view results, go to: https://console.apify.com/actors/runs/${data.data.id}`);
};

runActor().catch(console.error);
