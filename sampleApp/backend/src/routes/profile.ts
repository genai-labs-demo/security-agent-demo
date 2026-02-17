import { Router, Request, Response } from 'express';
import { getDatabasePool } from '../db/pool';
import { AppConfig } from '../config';

/**
 * Profile routes with intentional SQL injection vulnerability
 * WARNING: This endpoint is intentionally vulnerable for educational purposes
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

interface UserProfile {
  id: number;
  cognito_id: string;
  username: string;
  email: string;
  role: string;
  bio: string | null;
  created_at: Date;
}

interface EducationalMessage {
  vulnerability: string;
  what_happened: string;
  how_agent_detects: string;
  sample_payloads: string[];
}

interface ProfileResponse {
  success: boolean;
  message?: string;
  educational?: EducationalMessage;
  data?: UserProfile | UserProfile[];
  error?: string;
}

export function createProfileRouter(config: AppConfig): Router {
  const router = Router();

  /**
   * GET /api/profile/:userId
   * Intentionally vulnerable to SQL injection
   * 
   * This endpoint demonstrates SQL injection by:
   * - Using string concatenation to build SQL queries (no parameterization)
   * - Returning database error messages directly to the client
   * - Allowing authentication bypass and data extraction
   */
  router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const pool = getDatabasePool();

    try {
      // VULNERABILITY: SQL Injection through string concatenation
      // This is intentionally vulnerable - DO NOT use in production code!
      const query = `SELECT id, cognito_id, username, email, role, bio, created_at FROM users WHERE id = ${userId}`;
      
      console.log(`[VULNERABLE] Executing SQL query: ${query}`);
      
      const result = await pool.query(query);

      // Detect if SQL injection was successful
      const isSqlInjection = detectSqlInjection(userId, result.rows);

      if (isSqlInjection) {
        // Fetch educational content about SQL injection
        const educationalContent = await getEducationalContent('sql_injection');
        
        const response: ProfileResponse = {
          success: true,
          message: '🚨 Oh no! SQL Injection Detected!',
          educational: educationalContent,
          data: result.rows.length === 1 ? result.rows[0] : result.rows,
        };
        
        res.status(200).json(response);
      } else {
        // Normal response (no injection detected)
        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: 'User not found',
          });
        } else {
          res.status(200).json({
            success: true,
            data: result.rows[0],
          });
        }
      }
    } catch (error: any) {
      // VULNERABILITY: Expose database errors to the client
      // This reveals schema information and helps attackers
      console.error('[VULNERABLE] Database error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Database error',
        message: error.message, // Intentionally exposing error details
        detail: error.detail,
        hint: error.hint,
      });
    }
  });

  return router;
}

/**
 * Detect if SQL injection was attempted
 * This is a simple heuristic for educational purposes
 */
function detectSqlInjection(userId: string, results: any[]): boolean {
  // Check for common SQL injection patterns in the input
  const sqlInjectionPatterns = [
    /'/i,                    // Single quote
    /--/,                    // SQL comment
    /;/,                     // Statement terminator
    /union/i,                // UNION keyword
    /select/i,               // SELECT keyword (when not just a number)
    /or\s+/i,                // OR keyword
    /and\s+/i,               // AND keyword
    /1\s*=\s*1/i,           // Always true condition
    /\*/,                    // Wildcard
  ];

  const hasInjectionPattern = sqlInjectionPatterns.some(pattern => 
    pattern.test(userId)
  );

  // Also detect if we got more results than expected (e.g., OR 1=1)
  const unexpectedResults = results.length > 1;

  return hasInjectionPattern || unexpectedResults;
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
        vulnerability: 'SQL Injection',
        what_happened: 'Your input was directly concatenated into the SQL query without parameterization, allowing you to manipulate the query logic.',
        how_agent_detects: 'AWS Security Agent detects this by testing various SQL injection payloads and analyzing query patterns.',
        sample_payloads: ["' OR '1'='1", "admin' --", "' UNION SELECT * FROM users --"],
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
      vulnerability: 'SQL Injection',
      what_happened: 'Your input was directly concatenated into the SQL query without parameterization.',
      how_agent_detects: 'AWS Security Agent detects this by testing various SQL injection payloads.',
      sample_payloads: ["' OR '1'='1", "admin' --"],
    };
  }
}
