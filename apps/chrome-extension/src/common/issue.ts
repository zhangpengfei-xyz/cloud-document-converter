import { serializeError } from 'serialize-error'
import { version } from '../../package.json'

interface Issue {
  /**
   * Title
   */
  title: string
  /**
   * Description
   */
  body: string
  /**
   * Labels
   */
  labels?: Label[]
  /**
   * Issue template
   */
  template: string
}

enum Label {
  /**
   * Something isn't working
   */
  Bug = 'bug',
}

const issueTemplate = (errorInfo: string) => `
**Description**

A clear and concise description of what the bug is.

**Recording**

A GIF or video showing the issue happening. (If you don't include this, there's a very good chance your issue will be closed, because it's much too hard to figure out exactly what is going wrong, and it makes maintenance much harder.)

**Example Document**

A link to a Lark Document where the error can be reproduced. (Please ensure that the documentation is publicly accessible.)

**Steps**

To reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expectation**

A clear and concise description of what you expected to happen.

**Environment**

- Extension Version: ${version}
- Browser: [e.g. Chrome, Edge]

**Context**

Add any other context about the problem here. (The fastest way to have an issue fixed is to create a pull request with working, tested code and we'll help merge it.)

**Error Information**
\`\`\`json
${errorInfo}
\`\`\`
`

function generateIssueUrl(issue: Issue): string {
  const { title, body, labels = [], template } = issue

  const url = new URL(
    'https://github.com/whale4113/cloud-document-converter/issues/new',
  )

  if (title) url.searchParams.set('title', title)
  if (body) url.searchParams.set('body', body)
  if (labels.length > 0) url.searchParams.set('labels', labels.join(','))
  if (template) url.searchParams.set('template', template)

  return url.toString()
}

export const reportBug = (error: unknown): void => {
  let errorInfo = JSON.stringify(serializeError(error), null, 2)
  const MAX_ERROR_LENGTH = 1000
  if (errorInfo.length > MAX_ERROR_LENGTH) {
    errorInfo =
      errorInfo.slice(0, MAX_ERROR_LENGTH) + '\n...[truncated due to length]'
  }

  const url = generateIssueUrl({
    title: '',
    body: issueTemplate(errorInfo),
    labels: [Label.Bug],
    template: 'bug.md',
  })

  window.open(url, '__blank')
}
