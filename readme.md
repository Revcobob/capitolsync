# Texas Legislative FTP Scraper

An [Apify](https://apify.com) actor for scraping legislative data from the Texas Legislative FTP server and other similar government FTP repositories.

## Features

- Traverses FTP directories up to a specified depth
- Downloads and processes files based on extension filters
- Extracts text from HTML and TXT files
- Supports pattern matching for directories and files
- Stores results in a structured dataset
- Configurable throttling to avoid server overload

## Usage

### In the Apify Console

1. Go to the [Apify Console](https://console.apify.com/)
2. Click on "Create new" → "Actor"
3. Name your actor (e.g., "texas-legislative-ftp-scraper")
4. Upload the code from this repository or copy it manually
5. Build the actor
6. Run the actor with your desired configuration

### Via API

You can also run the actor via the Apify API:

```javascript
const response = await fetch('https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_APIFY_TOKEN'
    },
    body: JSON.stringify({
        memory: 4096,
        timeout: 600,
        input: {
            "ftpServer": "ftp.legis.state.tx.us",
            "basePath": "/bills/87R",
            "fileExtensions": [".html", ".pdf"],
            "directoryPatterns": ["/bills/87R/billtext/*"]
        }
    })
});
```

## Input Configuration

| Field | Type | Description |
|-------|------|-------------|
| `ftpServer` | String | FTP server address (default: "ftp.legis.state.tx.us") |
| `username` | String | FTP username (default: "anonymous" for public servers) |
| `password` | String | FTP password (default: empty string) |
| `basePath` | String | Starting directory path (default: "/") |
| `fileExtensions` | Array | List of file extensions to process (default: [".html", ".pdf", ".doc", ".txt"]) |
| `maxDepth` | Integer | Maximum directory depth to traverse (default: 3) |
| `maxFiles` | Integer | Maximum number of files to process (default: 1000) |
| `extractText` | Boolean | Whether to extract text from supported files (default: true) |
| `directoryPatterns` | Array | Only process directories matching these patterns (default: []) |
| `excludeDirectoryPatterns` | Array | Skip directories matching these patterns (default: []) |
| `filePatterns` | Array | Only process files matching these patterns (default: []) |
| `excludeFilePatterns` | Array | Skip files matching these patterns (default: []) |

## Output Data Structure

The actor saves the scraped data to the default dataset with this structure:

```json
{
    "url": "ftp://ftp.legis.state.tx.us/path/to/file.html",
    "filename": "file.html",
    "path": "/path/to/file.html",
    "size": 12345,
    "modifiedDate": "2023-04-06T12:34:56Z",
    "extension": ".html",
    "extractedText": "Text content of the file...",
    "metadata": {
        "title": "Document Title",
        "description": "Document Description",
        "keywords": "keywords, if, available"
    },
    "downloadedAt": "2023-04-06T15:30:45Z"
}
```

## Examples

### Basic Example

This will scrape HTML files from the root directory, with default settings:

```json
{
    "ftpServer": "ftp.legis.state.tx.us",
    "fileExtensions": [".html"]
}
```

### Advanced Example

This configuration will scrape all HTML and PDF files from bill directories in the 87th legislative session, excluding committee files:

```json
{
    "ftpServer": "ftp.legis.state.tx.us",
    "basePath": "/bills/87R",
    "fileExtensions": [".html", ".pdf"],
    "maxDepth": 5,
    "maxFiles": 5000,
    "extractText": true,
    "directoryPatterns": [
        "/bills/87R/billtext/*"
    ],
    "excludeDirectoryPatterns": [
        "*/committee/*"
    ],
    "filePatterns": [
        "HB.*", 
        "SB.*"
    ]
}
```

## Limitations

- PDF and DOC text extraction requires additional libraries not included by default
- FTP servers might have connection limits or throttling measures in place
- Large files might cause memory issues - adjust your actor's memory allocation accordingly
- Some government FTP servers may have unique quirks or unexpected directory structures

## Tips for Working with Texas Legislative Data

- The Texas Legislature FTP server organizes bills by session (e.g., `/bills/87R/` for the 87th Regular Session)
- Bill files are typically found in subdirectories like `/billtext/html/` or `/billtext/pdf/`
- House Bills are prefixed with "HB" and Senate Bills with "SB"
- Committee reports and meeting documents are in separate directories

## Customization

For more advanced text extraction from PDFs, consider adding the `pdf-parse` package to the dependencies and implementing PDF parsing in the code.
