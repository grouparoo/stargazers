# Stargazers

Get list of people that have starred our repo

## Setup

`npm install`
copy `.env.example` to `.env` and set `GITHUB_AUTH_TOKEN`

## Run

`npm run dev`

or

`npm run build && npm start`

Outputs `stargazers.csv` file.

If there is a file called `input.csv`, it will be additive to that document. That is, is won't change any data there, but add new people at the bottom with the given columns.
