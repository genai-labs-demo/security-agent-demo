import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDatabasePool } from '../db/pool';
import { AppConfig } from '../config';

const execAsync = promisify(exec);

/**
 * Tools routes with intentional command injection vulnerability
 * WARNING: This endpoint is intentionally vulnerable for educational purposes
 * Requirements: 5.1, 5.2, 5.3
 */

interface EducationalMessage {
  vulnerability: string;
  what_happened: string;
  how_agent_detects: string;
  sample_payloads: string[];
}

interface PingResponse {
  success: boolean;
  message?: string;
  educational?: EducationalMessage;
  output?: string;
  error?: string;
}

export function createToolsRouter(config: AppConfig): Router {
  const router = Router();

  /**
   * POST /api/tools/ping
   * Intentionally vulnerable to command injection
   * 
   * This endpoint demonstrates command injection by:
   * - Executing system commands with unsanitized user input
   * - Using shell command execution without input validation
   * - Returning command output directly to the client
   */
  router.post('/ping', async (req: Request, res: Response): Promise<void> => {
    const { host } = req.body;

    if (!host) {
      res.status(400).json({
        success: false,
        error: 'Host parameter is required',
      });
      return;
    }

    try {
      // VULNERABILITY: Command Injection through unsanitized input
      // This is intentionally vulnerable - DO NOT use in production code!
      const command = `ping -c 4 ${host}`;
      
      console.log(`[VULNERABLE] Executing command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      const output = stdout || stderr;

      // Detect if command injection was successful
      const isCommandInjection = detectCommandInjection(host, output);

      if (isCommandInjection) {
        // Fetch educational content about command injection
        const educationalContent = await getEducationalContent('command_injection');
        
        const response: PingResponse = {
          success: true,
          message: '🚨 Oh no! Command Injection Detected!',
          educational: educationalContent,
          output: output,
        };
        
        res.status(200).json(response);
      } else {
        // Normal response (no injection detected)
        res.status(200).json({
          success: true,
          output: output,
        });
      }
    } catch (error: any) {
      // VULNERABILITY: Expose command execution errors to the client
      // This reveals system information and helps attackers
      console.error('[VULNERABLE] Command execution error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Command execution failed',
        message: error.message, // Intentionally exposing error details
        output: error.stdout || error.stderr,
      });
    }
  });

  return router;
}

/**
 * Detect if command injection was attempted
 * This is a simple heuristic for educational purposes
 */
function detectCommandInjection(host: string, output: string): boolean {
  // Check for common command injection patterns in the input
  const commandInjectionPatterns = [
    /;/,                     // Command separator
    /\|/,                    // Pipe
    /&/,                     // Background execution or AND
    /`/,                     // Command substitution
    /\$\(/,                  // Command substitution
    /\n/,                    // Newline
    />/,                     // Redirect
    /</,                     // Redirect
  ];

  const hasInjectionPattern = commandInjectionPatterns.some(pattern => 
    pattern.test(host)
  );

  // Check if output contains evidence of command execution beyond ping
  // (e.g., directory listings, file contents, etc.)
  const hasUnexpectedOutput = !output.includes('PING') && output.length > 0;
  const hasMultipleCommands = output.split('\n').length > 20; // Ping typically has fewer lines

  return hasInjectionPattern || hasUnexpectedOutput || hasMultipleCommands;
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
        vulnerability: 'Command Injection',
        what_happened: 'Your input was directly passed to a system command without sanitization, allowing you to execute arbitrary commands on the server.',
        how_agent_detects: 'AWS Security Agent detects this by testing various command injection payloads and analyzing command execution patterns.',
        sample_payloads: ['; ls -la', '| cat /etc/passwd', '&& whoami', '`id`'],
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
      vulnerability: 'Command Injection',
      what_happened: 'Your input was directly passed to a system command without sanitization.',
      how_agent_detects: 'AWS Security Agent detects this by testing various command injection payloads.',
      sample_payloads: ['; ls -la', '| cat /etc/passwd', '&& whoami'],
    };
  }
}
