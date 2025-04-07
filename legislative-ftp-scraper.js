// For more information, see https://sdk.apify.com
import { Actor } from 'apify';
import ftp from 'basic-ftp';
import { createReadStream } from 'fs';
import path from 'path';
import fs from 'fs/promises';
import cheerio from 'cheerio';
import iconv from 'iconv-lite';

// Initialize the Apify SDK
await Actor.init();

// Get input of the actor
const input = await Actor.getInput();
const {
    ftpServer = 'ftp.legis.state.tx.us',
    username = 'anonymous',
    password = '',
    basePath = '/',
    fileExtensions = ['.html', '.pdf', '.doc', '.txt'],
    maxDepth = 3,
    maxFiles = 1000,
    extractText = true,
    directoryPatterns = [],
    excludeDirectoryPatterns = [],
    filePatterns = [],
    excludeFilePatterns = [],
    proxyConfiguration,
} = input || {};

// Initialize the dataset where we'll store our results
const dataset = await Actor.openDataset();
let processedFilesCount = 0;

// Create a key-value store for temporary file storage
const store = await Actor.openKeyValueStore();

// Connect to FTP server and process files
console.log(`Connecting to FTP server: ${ftpServer}`);

// For tracking directories we've already visited
const visitedDirs = new Set();

// Process a directory and its subdirectories recursively
async function processDirectory(client, currentPath, depth = 0) {
    // Skip if we've reached max depth or already visited this directory
    if (depth > maxDepth || visitedDirs.has(currentPath)) {
        return;
    }
    
    visitedDirs.add(currentPath);
    console.log(`Processing directory: ${currentPath} (depth: ${depth})`);
    
    // Skip directories that don't match patterns or match exclude patterns
    if (directoryPatterns.length > 0) {
        const matchesPattern = directoryPatterns.some(pattern => 
            new RegExp(pattern.replace(/\*/g, '.*')).test(currentPath));
        if (!matchesPattern) {
            console.log(`Skipping directory ${currentPath} - doesn't match include patterns`);
            return;
        }
    }
    
    if (excludeDirectoryPatterns.length > 0) {
        const matchesExclude = excludeDirectoryPatterns.some(pattern => 
            new RegExp(pattern.replace(/\*/g, '.*')).test(currentPath));
        if (matchesExclude) {
            console.log(`Skipping directory ${currentPath} - matches exclude pattern`);
            return;
        }
    }
    
    try {
        // List files in the current directory
        await client.cd(currentPath);
        const list = await client.list();
        
        // Process each entry (file or directory)
        for (const item of list) {
            // Stop if we've reached the maximum number of files
            if (processedFilesCount >= maxFiles) {
                console.log(`Reached maximum file count (${maxFiles}). Stopping.`);
                return;
            }
            
            const itemPath = path.join(currentPath, item.name).replace(/\\/g, '/');
            
            if (item.isDirectory) {
                // Recursively process subdirectories
                await processDirectory(client, itemPath, depth + 1);
            } else if (item.isFile) {
                // Check file extension
                const extension = path.extname(item.name).toLowerCase();
                if (!fileExtensions.includes(extension)) {
                    continue;
                }
                
                // Check file patterns
                if (filePatterns.length > 0) {
                    const matchesPattern = filePatterns.some(pattern => 
                        new RegExp(pattern.replace(/\*/g, '.*')).test(item.name));
                    if (!matchesPattern) continue;
                }
                
                // Check exclude patterns
                if (excludeFilePatterns.length > 0) {
                    const matchesExclude = excludeFilePatterns.some(pattern => 
                        new RegExp(pattern.replace(/\*/g, '.*')).test(item.name));
                    if (matchesExclude) continue;
                }
                
                console.log(`Processing file: ${itemPath}`);
                
                // Download the file to temp storage
                const tempFilePath = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                const localPath = await store.getWritableStreamPath(tempFilePath);
                
                try {
                    await client.downloadTo(localPath, item.name);
                    
                    // Process the file based on its type
                    let extractedText = '';
                    let metadata = {};
                    
                    if (extractText) {
                        if (extension === '.html') {
                            const content = await fs.readFile(localPath, 'utf8');
                            const $ = cheerio.load(content);
                            extractedText = $('body').text().trim();
                            
                            // Extract metadata from HTML if it exists
                            metadata = {
                                title: $('title').text().trim() || '',
                                description: $('meta[name="description"]').attr('content') || '',
                                keywords: $('meta[name="keywords"]').attr('content') || '',
                            };
                        } else if (extension === '.txt') {
                            // TXT files on government servers might have unusual encodings
                            const buffer = await fs.readFile(localPath);
                            extractedText = iconv.decode(buffer, 'utf8');
                        }
                        // Note: PDF/DOC extraction would require additional libraries
                    }
                    
                    // Add the file info to our dataset
                    await dataset.pushData({
                        url: `ftp://${ftpServer}${itemPath}`,
                        filename: item.name,
                        path: itemPath,
                        size: item.size,
                        modifiedDate: item.modifiedAt,
                        extension,
                        extractedText: extractedText || undefined,
                        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                        downloadedAt: new Date().toISOString(),
                    });
                    
                    processedFilesCount++;
                    
                    // Clean up the temporary file
                    await store.delete(tempFilePath);
                } catch (downloadError) {
                    console.error(`Error downloading file ${itemPath}: ${downloadError.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${currentPath}: ${error.message}`);
    }
}

// Main execution
try {
    const client = new ftp.Client();
    client.ftp.verbose = false; // Set to true for debugging
    
    // Configure timeout as these operations can be slow
    client.ftp.socket.setTimeout(60000 * 5); // 5 minute timeout
    
    // Connect to FTP server
    await client.access({
        host: ftpServer,
        user: username,
        password: password,
        secure: false, // Most gov FTP servers don't use FTPS
    });
    
    console.log('Connected to FTP server successfully');
    
    // Begin processing from the base path
    await processDirectory(client, basePath);
    
    // Close connection
    client.close();
    
    console.log(`Finished processing. Total files processed: ${processedFilesCount}`);
} catch (error) {
    console.error(`Actor failed: ${error.message}`);
    throw error;
} finally {
    // Close the Actor
    await Actor.exit();
}
