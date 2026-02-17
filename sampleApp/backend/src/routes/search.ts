import { Router, Request, Response } from 'express';
import { getDatabasePool } from '../db/pool';
import { AppConfig } from '../config';

/**
 * Search routes with intentional reflected XSS vulnerability
 * WARNING: This endpoint is intentionally vulnerable for educational purposes
 * Requirements: 4.1, 4.5
 */

interface EducationalMessage {
  vulnerability: string;
  what_happened: string;
  how_agent_detects: string;
  sample_payloads: string[];
}

interface SearchResponse {
  success: boolean;
  query: string;
  message: string;
  educational?: EducationalMessage;
  data?: any[];
  error?: string;
}

export function createSearchRouter(config: AppConfig): Router {
  const router = Router();

  /**
   * GET /api/search
   * Intentionally vulnerable to reflected XSS
   * 
   * This endpoint demonstrates reflected XSS by:
   * - Reflecting user input directly in the response without sanitization
   * - No HTML encoding or validation of query parameter
   * - Allowing script tags and malicious content to be reflected
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q as string || '';

    // VULNERABILITY: Reflected XSS - reflecting unsanitized user input
    // This is intentionally vulnerable - DO NOT use in production code!
    console.log(`[VULNERABLE] Reflecting unsanitized search query: ${query}`);

    const pool = getDatabasePool();
    
    try {
      // Search comments (case-insensitive)
      const searchResults = await pool.query(`
        SELECT c.id, c.user_id, c.content, c.created_at, u.username
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.content ILIKE $1
        ORDER BY c.created_at DESC
      `, [`%${query}%`]);

      // Detect if XSS was attempted
      const isXss = detectXss(query);

      if (isXss) {
        // Fetch educational content about reflected XSS
        const educationalContent = await getEducationalContent('xss_reflected');
        
        // Reflect the search query directly in the response without encoding
        const response: SearchResponse = {
          success: true,
          query: query, // Unsanitized reflection
          message: `🚨 Oh no! Reflected XSS Detected! You searched for: ${query}`, // Unsanitized reflection
          educational: educationalContent,
          data: searchResults.rows,
        };

        res.status(200).json(response);
      } else {
        // Reflect the search query directly in the response without encoding
        const response: SearchResponse = {
          success: true,
          query: query, // Unsanitized reflection
          message: `You searched for: ${query}`, // Unsanitized reflection in message
          data: searchResults.rows,
        };

        res.status(200).json(response);
      }
    } catch (error: any) {
      console.error('[VULNERABLE] Search error:', error);
      
      res.status(500).json({
        success: false,
        query: query, // Still reflecting the query even in error
        message: `Search failed for: ${query}`,
        error: error.message,
      });
    }
  });

  return router;
}

/**
 * Detect if XSS was attempted
 * This is a simple heuristic for educational purposes
 */
function detectXss(content: string): boolean {
  // Check for common XSS patterns in the input
  const xssPatterns = [
    /<script/i,              // Script tag
    /<\/script>/i,           // Closing script tag
    /javascript:/i,          // JavaScript protocol
    /onerror\s*=/i,          // onerror event handler
    /onload\s*=/i,           // onload event handler
    /onclick\s*=/i,          // onclick event handler
    /onmouseover\s*=/i,      // onmouseover event handler
    /<img/i,                 // Image tag (often used for XSS)
    /<iframe/i,              // Iframe tag
    /<object/i,              // Object tag
    /<embed/i,               // Embed tag
    /alert\s*\(/i,           // Alert function
    /document\.cookie/i,     // Cookie access
    /eval\s*\(/i,            // Eval function
  ];

  return xssPatterns.some(pattern => pattern.test(content));
}

/**
 * Fetch educational content from the database
 */
async function getEducationalContent(vulnType: string): Promise<EducationalMessage> {
  const pool = getDatabasePool();
  
  try {
    const result = await pool.query(
      'SELECT title, description, sample_payloads, detection_info FROM vulnerability_info WHERE vuln_type = $1',
      [vulnType]
    );

    if (result.rows.length === 0) {
      // Fallback educational content
      return {
        vulnerability: 'Reflected Cross-Site Scripting (XSS)',
        what_happened: 'Your input was directly reflected in the HTTP response without sanitization or HTML encoding, allowing malicious scripts to execute in the context of the application.',
        how_agent_detects: 'AWS Security Agent detects this by submitting various XSS payloads and checking if they are reflected and executed in the response.',
        sample_payloads: [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          '<svg onload=alert("XSS")>',
          'javascript:alert("XSS")',
        ],
      };
    }

    const row = result.rows[0];
    return {
      vulnerability: row.title,
      what_happened: row.description,
      how_agent_detects: row.detection_info,
      sample_payloads: row.sample_payloads,
    };
  } catch (error) {
    console.error('Error fetching educational content:', error);
    // Return fallback content
    return {
      vulnerability: 'Reflected Cross-Site Scripting (XSS)',
      what_happened: 'Your input was directly reflected without sanitization.',
      how_agent_detects: 'AWS Security Agent detects this by testing various XSS payloads.',
      sample_payloads: ['<script>alert("XSS")</script>', '<img src=x onerror=alert("XSS")>'],
    };
  }
}
