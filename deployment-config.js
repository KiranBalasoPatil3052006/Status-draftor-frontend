// deployment-config.js
(function () {
    const hostname = window.location.hostname;

    // Check if running on localhost or 127.0.0.1
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    // Local Backend URL
    const LOCAL_API = 'http://localhost:5000/api';

    // Production Backend URL (REPLACE THIS with your actual Render/Deployment URL)
    // Example: 'https://status-drafter-backend.onrender.com/api'
    const PROD_API = 'https://status-drafter-backend.onrender.com/api';

    // Set the global API_URL based on the environment
    window.API_URL = isLocal ? LOCAL_API : PROD_API;

    console.log(`[Config] Environment: ${isLocal ? 'Local' : 'Production'}`);
    console.log(`[Config] API URL set to: ${window.API_URL}`);
})();
