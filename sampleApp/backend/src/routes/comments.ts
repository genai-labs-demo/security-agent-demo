import { Router, Request, Response } from 'express';
import { getDatabasePool } from '../db/pool';
import { AppConfig } from '../config';

/**
 * Comments routes with intentional XSS vulnerability
 * WARNING: This endpoint is intentionally vulnerable for educational purposes
 * Requirements: 4.1, 4.2, 4.5
 */

interface Comment {
  id: number;
  user_id: number;
  content: string;
  created_at: Date;
  username?: string;
}

interface EducationalMessage {
  vulnerability: string;
  what_happened: string;
  how_agent_detects: string;
  sample_payloads: string[];
}

interface CommentResponse {
  success: boolean;
  message?: string;
  educational?: EducationalMessage;
  data?: Comment | Comment[];
  error?: string;
}

export function createCommentsRouter(config: AppConfig): Router {
  const router = Router();

  /**
   * POST /api/comments
   * Intentionally vulnerable to stored XSS
   * 
   * This endpoint demonstrates stored XSS by:
   * - Storing user input directly in the database without sanitization
   * - No HTML encoding or validation of input
   * - Allowing script tags and malicious content to be stored
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { user_id, content } = req.body;

    if (!user_id || !content) {
      res.status(400).json({
        success: false,
        error: 'user_id and content are required',
      });
      return;
    }

    const pool = getDatabasePool();

    try {
      // VULNERABILITY: Stored XSS - storing unsanitized user input
      // This is intentionally vulnerable - DO NOT use in production code!
      // No sanitization, no HTML encoding, no validation
      console.log(`[VULNERABLE] Storing unsanitized comment: ${content}`);
      
      const result = await pool.query(
        'INSERT INTO comments (user_id, content, created_at) VALUES ($1, $2, NOW()) RETURNING id, user_id, content, created_at',
        [user_id, content]
      );

      // Detect if XSS was attempted
      const isXss = detectXss(content);

      if (isXss) {
        // Fetch educational content about stored XSS
        const educationalContent = await getEducationalContent('xss_stored');
        
        const response: CommentResponse = {
          success: true,
          message: '🚨 Oh no! Stored XSS Detected!',
          educational: educationalContent,
          data: result.rows[0],
        };

        res.status(201).json(response);
      } else {
        const response: CommentResponse = {
          success: true,
          message: 'Comment created successfully',
          data: result.rows[0],
        };

        res.status(201).json(response);
      }
    } catch (error: any) {
      console.error('[VULNERABLE] Database error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to create comment',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/comments
   * Intentionally vulnerable to stored XSS
   * 
   * This endpoint demonstrates stored XSS by:
   * - Retrieving and returning stored content without encoding
   * - No HTML sanitization on output
   * - Allowing stored scripts to be executed when rendered
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const pool = getDatabasePool();

    try {
      // VULNERABILITY: Stored XSS - returning unsanitized content
      // This is intentionally vulnerable - DO NOT use in production code!
      console.log('[VULNERABLE] Retrieving comments without sanitization');
      
      const result = await pool.query(`
        SELECT c.id, c.user_id, c.content, c.created_at, u.username
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
      `);

      // Check if any comments contain XSS
      const hasXss = result.rows.some(comment => detectXss(comment.content));

      if (hasXss) {
        // Fetch educational content about stored XSS
        const educationalContent = await getEducationalContent('xss_stored');
        
        const response: CommentResponse = {
          success: true,
          message: '🚨 Oh no! Stored XSS Detected in Comments!',
          educational: educationalContent,
          data: result.rows,
        };

        res.status(200).json(response);
      } else {
        const response: CommentResponse = {
          success: true,
          data: result.rows,
        };

        res.status(200).json(response);
      }
    } catch (error: any) {
      console.error('[VULNERABLE] Database error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve comments',
        message: error.message,
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
        vulnerability: 'Stored Cross-Site Scripting (XSS)',
        what_happened: 'Your input was stored in the database without sanitization and is being displayed without HTML encoding, allowing malicious scripts to execute when other users view this content.',
        how_agent_detects: 'AWS Security Agent detects this by submitting various XSS payloads and checking if they are stored and executed when retrieved.',
        sample_payloads: [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          '<svg onload=alert("XSS")>',
          '<iframe src="javascript:alert(\'XSS\')">',
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
      vulnerability: 'Stored Cross-Site Scripting (XSS)',
      what_happened: 'Your input was stored without sanitization and is displayed without encoding.',
      how_agent_detects: 'AWS Security Agent detects this by testing various XSS payloads.',
      sample_payloads: ['<script>alert("XSS")</script>', '<img src=x onerror=alert("XSS")>'],
    };
  }
}
