# MyTracker - Personal Finance Tracker

A mobile-first PWA for tracking personal finances, vendor payments, and project costs.
Data stored in Google Sheets. Hosted on GitHub Pages.

## Tech Stack

React 19, Vite 8, Tailwind CSS 4, Google Sheets API, Google OAuth 2.0

## Setup

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your Google Cloud credentials
4. `npm run dev`

## Google Cloud Setup

1. Create project at console.cloud.google.com
2. Enable Google Sheets API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized JavaScript origins (localhost:5173 for dev, your GitHub Pages URL for prod)
5. Add credentials to `.env` and GitHub Secrets

## Deploy

Push to `main` branch. GitHub Actions auto-deploys to Pages.

## Live

https://guruprasanthsaravanan.github.io/my-tracker/
