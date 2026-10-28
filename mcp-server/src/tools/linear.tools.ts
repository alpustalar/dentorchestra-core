export const linearTools = [
  {
    name: 'get_linear_issue',
    description:
      'Linear API üzerinden verilen Issue ID (örn: ENG-12) ile iş detaylarını getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Linear Issue Anahtarı (Örn: ENG-12)',
        },
      },
      required: ['issueId'],
    },
    handler: async (args: any) => {
      const issueId = String(args?.issueId);
      const linearApiKey = process.env.LINEAR_API_KEY;

      if (!linearApiKey) {
        throw new Error('LINEAR_API_KEY ortam değişkeni (env) tanımlı değil.');
      }

      const query = `
        query GetIssue($id: String!) {
          issue(id: $id) {
            id
            title
            description
            state { name }
            project { name }
            parent { title }
            children { nodes { id title state { name } } }
          }
        }
      `;

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: linearApiKey,
        },
        body: JSON.stringify({ query, variables: { id: issueId } }),
      });

      const result = await response.json();
      return JSON.stringify(result.data?.issue || result, null, 2);
    },
  },
];
