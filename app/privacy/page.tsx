'use client'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import Markdown from 'react-markdown'

const privacyContent = `
# Privacy Policy

## Introduction

Welcome to ExplainGithub by [PWM Group](https://www.programmingwithmaurya.com). We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.

## GitHub Authentication & User Data

We do not save or store your GitHub access token when you log in using GitHub OAuth. This means we cannot access your GitHub username, email, repositories, or any other GitHub account information without your explicit permission during each session.

For more detailed information about how GitHub OAuth works, please visit:
[GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

This is why we ask for your information before logging in with GitHub - to save basic user information for our records while respecting your privacy on GitHub.

## The Data We Collect

When you use our application, we may collect the following types of information:

### Personal Information
- GitHub account information (when you authenticate)
- Email address
- Usage data and preferences

### Technical Data
- IP address (used to understand user geographical information)
- Browser type and version
- Time zone setting and location
- Operating system and platform
- Device information

## User Chats & Content

Currently, we do not save any user chats or conversation history. All chat interactions are temporary and not stored in our database.

## How We Use Your Data

We use your data for the following purposes:
- To provide and maintain our service
- To notify you about changes to our service
- To allow you to participate in interactive features
- To provide customer support
- To gather analysis or valuable information to improve our service
- To monitor the usage of our service
- To detect, prevent and address technical issues

## Data Security

We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.

## Third-Party Services

Our service may contain links to other websites that are not operated by us. If you click on a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.

## Changes to This Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.

## Contact Us

If you have any questions about this Privacy Policy, please contact us:
- By email: privacy@programmingwithmaurya.com
- By visiting the feedback page on our website

Last Updated: ${new Date().toLocaleDateString()}
`

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden p-8">
          <div className="prose dark:prose-invert max-w-none markdown-body">
            <Markdown
              components={{
                code({className, children}) {
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    <div className="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        showLineNumbers
                        customStyle={{ 
                          margin: 0, 
                          background: 'transparent',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          padding: '1rem'
                        }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={`${className} px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700`}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {privacyContent}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  )
} 