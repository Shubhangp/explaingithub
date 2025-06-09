import { useState, useEffect } from 'react'
import React from 'react'
import { useSession, signIn } from 'next-auth/react'
import { FaGithub, FaMoon, FaSun, FaList, FaProjectDiagram, FaCode, FaExpand, FaCompress } from 'react-icons/fa'
import DirectoryViewer from './DirectoryViewer'
import FileViewer from './FileViewer'
import ChatBox from './ChatBox'
import RepositoryInfo from './RepositoryInfo'

// Add mobile styles
const styles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px',
    boxSizing: 'border-box',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  mainContent: {
    width: '100%',
  },
  desktopLayout: {
    width: '100%',
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },
  mobileLayout: {
    display: 'none',
    '@media (max-width: 768px)': {
      display: 'block',
    },
  },
  fileViewerContainer: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    marginBottom: '20px',
    padding: '20px',
  },
  chatBoxContainer: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    marginBottom: '20px',
    overflow: 'hidden',
    height: '600px',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    margin: '0 -10px',
  },
  col50: {
    width: '50%',
    padding: '0 10px',
    '@media (max-width: 768px)': {
      width: '100%',
    },
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  expandButton: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
  },
}

interface RepoViewerProps {
  owner: string
  repo: string
  provider?: 'github' | 'gitlab'
}

export default function RepoViewer({ owner, repo, provider = 'github' }: RepoViewerProps) {
  const { data: session, status } = useSession()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Setup responsive detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    // Initial check
    handleResize()
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // To avoid hydration mismatch, render conditionally only on client-side
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    return null // Return nothing during SSR
  }

  return (
    <div style={styles.container as React.CSSProperties}>
      <div style={styles.header as React.CSSProperties}>
        <h1 style={styles.title as React.CSSProperties}>{owner}/{repo}</h1>
      </div>

      {/* Main content container */}
      <div style={styles.mainContent as React.CSSProperties}>
        {/* Top row with Directory Viewer and Repo Explorer */}
          <div style={styles.row as React.CSSProperties}>
            <div style={styles.col50 as React.CSSProperties}>
              <div style={styles.fileViewerContainer as React.CSSProperties}>
                <h2 style={styles.sectionTitle as React.CSSProperties}>Files</h2>
                <DirectoryViewer
                  owner={owner}
                  repo={repo}
                  provider={provider}
                  onFileSelect={setSelectedFile}
                />
              </div>
            </div>
            <div style={styles.col50 as React.CSSProperties}>
              <div style={{
                height: '100%',
                overflow: 'auto',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Repository Explorer</h2>
                <RepositoryInfo owner={owner} repo={repo} />
              </div>
            </div>
          </div>

        {/* File Viewer (bottom section) */}
        <div className="fileViewer">
          <div style={styles.fileViewerContainer as React.CSSProperties}>
            <h2 style={styles.sectionTitle as React.CSSProperties}>File Viewer</h2>
            <FileViewer
              owner={owner}
              repo={repo}
              filePath={selectedFile}
              provider={provider}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 