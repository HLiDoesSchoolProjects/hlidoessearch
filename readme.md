# HLiDoesSearch

A computer-screen-eatingly horrendous search engine by HLiDoesSchoolProjects™ that roughly gets what you're searching for.

## Usage

This project is made up of 2 parts: the web crawler-scorer, and the search API + frontend.

Run `npm install` first to install the dependencies for both of the components.

## The Crawler: hldspbot

The **HL**i**D**oes**S**chool**P**rojects™ **Bot** crawls the internet™ to gather pages and scores them for each searchable word they have, generating a data file at `data/data.json`.

A default data file of around 660 of some of the most popular sites is provided. If you want to use hldspbot to fetch data for yourself, run:

```bash
node hldspbot
```
to start from the popular sites list, crawling a maximum of 500 pages;

```bash
node hldspbot <link>
```
to start from a custom entry page, crawling a maximum of 5 pages;

```bash
node hldspbot <link> -c <count>
```
to start from a custom entry page, crawling a custom maximum number of pages.

## The Search Engine

To start the search server, run:

```bash
node api
```

After starting, you can access HLiDoesSearch at `localhost:3001`.

Source code for the search frontend is located in the `web` directory.