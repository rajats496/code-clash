# Deployment Instructions

1. **Commit and push to GitHub (which triggers Render):**
   ```bash
   git add .
   git commit -m "Fix socket issues, track online users in Redis, and handle opponent disconnect gracefully"
   git push origin main
   ```

2. **SSH into the EC2 instance, pull code, and restart the backend processes:**
   ```bash
   ssh -i "path/to/key.pem" ubuntu@3.111.188.120
   cd /home/ubuntu/code-clash
   git pull origin main
   pm2 restart code-clash-api
   pm2 restart code-clash-worker
   ```

---

# TestSprite E2E Setup for WebSockets

Since you have zero E2E testing frameworks right now, **TestSprite** is a perfect choice! TestSprite is an AI-powered QA solution that can write, execute, and maintain test scenarios for you.

For real-time WebSocket apps, it can run complex multi-tab scenarios to test disconnection edge cases.

### Integration Steps:
1. Go to [TestSprite.com](https://testsprite.com) and create an account.
2. In the dashboard, configure a new Project pointing to your **staging** or **local development URL** (e.g., `http://localhost:5173`).
3. You can define a scenario in plain English for the AI to execute. For example:
   * **Scenario:** "Open two browser windows, log in as User A and User B. Queue up a match and wait for the match to start. In Window B, simulate a sudden network disconnect or close the tab. Verify that Window A instantly shows a 'Victory by Forfeit (Opponent Disconnected)' modal."
4. TestSprite handles the Playwright/Puppeteer orchestration under the hood, running the test and reporting any regressions back to your dashboard or CI/CD pipeline.