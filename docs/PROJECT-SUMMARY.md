# Readout — Project Summary

**Readout** is unified outreach automation driven by your repo. Connect a GitHub repository and a short brief; the system ingests your docs, builds a product knowledge base, and generates channel-specific outreach (Reddit, email, LinkedIn) from a single source of truth.

## Problem

Founders and small teams spend weeks rewriting the same story for Reddit, email, LinkedIn, and other channels—switching between tools, re-explaining the product, and struggling to keep messaging consistent. There’s no single place that uses the repo as the source of truth and produces on-brand drafts for every channel.

## Solution

- **Ingest** — Pull README, `/docs`, and optional paths from GitHub; parse markdown and summarize with AI into a stored knowledge base.
- **Brief** — Define audience, tone, goals, and channels once. One brief drives all channel generation.
- **Generate** — Produce on-brand drafts per channel: Reddit (subreddit discovery + post drafts), email (subject + body), LinkedIn (post copy). Optional AI chat to refine the brief and improve drafts.
- **Manage** — View drafts, re-sync from repo, regenerate; scheduling and publishing are planned.

Product truth stays in the repo; re-sync keeps messaging aligned with the latest docs and releases.

## Tech

- **Backend:** FastAPI, Gemini (summarization), Claude/Dust (drafts and chat), PRAW + custom scraper (Reddit), Supabase (product knowledge, briefs, drafts). Optional: Apollo (leads), ElevenLabs (TTS).
- **Frontend:** Vite, React, shadcn/ui, wired to the Readout API (ingest, brief, generate, discover subreddits, chat, improve draft).

## Status

Core pipeline implemented: GitHub ingest → product knowledge → briefs → channel-specific draft generation (Reddit, email, LinkedIn, Hacker News). Subreddit discovery, draft storage, and improve-draft endpoints in place. Frontend integration and scheduling/publishing are in progress.

## One-liner

*Unified outreach from your repo: connect once, brief once, generate everywhere.*
