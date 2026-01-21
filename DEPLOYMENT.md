# GymPartner Deployment Guide

This guide details how to deploy your GymPartner application to [Railway](https://railway.app/).

## Prerequisites

-   A GitHub repository with your project code.
-   A [Railway](https://railway.app/) account.
-   A [Supabase](https://supabase.com/) project for your database.
-   A [Google Cloud Console](https://console.cloud.google.com/) project (for Maps).
-   A [Google AI Studio](https://aistudio.google.com/) API Key.
-   (Optional) A [Cloudinary](https://cloudinary.com/) account for video handling.

## 1. Project Setup on Railway

1.  Log in to your Railway dashboard.
2.  Click **"New Project"**.
3.  Select **"Deploy from GitHub repo"**.
4.  Choose your repository (`GymPartner`).
5.  Railway will automatically detect the project settings. It should identify `npm` and the `start` command from `package.json`.

## 2. Environment Variables

**CRITICAL:** Your application will fail to load or feature broken functionality if these are missing.

Go to the **"Variables"** tab in your Railway project service and add the following:

| Variable | Description | Where to find |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon Public Key | Supabase Dashboard > Settings > API |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API Key | [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials) |
| `VITE_GEMINI_API_KEY` | Google Gemini API Key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VITE_CLOUDINARY_CLOUD_NAME` | (Optional) Cloudinary Cloud Name | [Cloudinary Dashboard](https://cloudinary.com/console) |
| `VITE_CLOUDINARY_UPLOAD_PRESET`| (Optional) Cloudinary Preset | [Cloudinary Settings](https://cloudinary.com/console/settings/upload) |

> **Note:** Variables starting with `VITE_` are embedded into the application at **build time**. If you change these variables in Railway, you MUST trigger a **Redeploy** for the changes to take effect.

## 3. Build & Deploy

Railway should automatically handle the build using the scripts in `package.json`:
-   **Build Command:** `npm run build` (runs `vite build`)
-   **Start Command:** `npm run start` (runs `serve -s dist`)

If your deployment is stuck or "not loading", check the **Deploy Log** and verify:
1.  The build finished successfully (`✓ built in ...`).
2.  The start command ran successfully.
3.  You have no missing Environment Variables (check the list above).

## Troubleshooting

-   **White Screen / Not Loading:** Open your browser's Developer Tools (F12) -> Console. If you see errors like `undefined is not ...` or 404s for resources, it is almost always a missing `VITE_` environment variable during the build. Add the variable and redeploy.
-   **Map not showing:** Verify `VITE_GOOGLE_MAPS_API_KEY` is correct and has "Maps JavaScript API" enabled in Google Cloud.
