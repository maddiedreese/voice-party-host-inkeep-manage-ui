# Inkeep Manage UI - Netlify Deployment Guide

## Prerequisites
- Manage API deployed and running
- Run API deployed and running
- Bypass secrets from both APIs

## Environment Variables for Netlify

Set these in your Netlify dashboard under Site Settings > Environment Variables:

```
ENVIRONMENT=production
INKEEP_AGENTS_MANAGE_API_URL=https://your-manage-api.netlify.app
INKEEP_AGENTS_RUN_API_URL=https://your-run-api.netlify.app
INKEEP_AGENTS_MANAGE_API_BYPASS_SECRET=<from-manage-api-deployment>
INKEEP_AGENTS_RUN_API_BYPASS_SECRET=<from-run-api-deployment>
SIGNOZ_URL=https://your-org.signoz.cloud
SIGNOZ_API_KEY=your-signoz-key
NANGO_SECRET_KEY=e4aed064-122b-49da-b488-b9b6cd769cda
NANGO_SERVER_URL=https://api.nango.dev
```

## Deployment Steps

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/voice-party-host-inkeep-manage-ui.git
   git push -u origin main
   ```

2. **Deploy to Netlify**:
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Connect your GitHub repository
   - Build settings are already configured in netlify.toml
   - Add environment variables
   - Deploy

3. **Test the deployment**:
   - Visit your Netlify URL
   - Should see the Inkeep management interface

## Next Steps
After deployment, you can:
1. Create your trivia helper agent
2. Configure the agent settings
3. Test the agent functionality
4. Update your main app to use the deployed services
