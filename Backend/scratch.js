const { processChat } = require('./services/chatbot.service');
(async () => {
  try {
    console.log("Testing processChat...");
    const result = await processChat("leads from linkedin from 2026-6-14 to 2026-6-23", []);
    console.log("Result:", result);
  } catch (err) {
    console.error("Caught error:", err);
  }
  process.exit();
})();
