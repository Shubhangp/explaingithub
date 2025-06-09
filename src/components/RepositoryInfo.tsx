import React, { useState, useEffect } from 'react';

interface RepositoryInfoProps {
  owner: string;
  repo: string;
}

const RepositoryInfo: React.FC<RepositoryInfoProps> = ({ owner, repo }) => {
  const [repoInfo, setRepoInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch repository info: ${response.status}`);
        }
        
        const data = await response.json();
        setRepoInfo(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRepoInfo();
  }, [owner, repo]);

  if (loading) {
    return <div>Loading repository information...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!repoInfo) {
    return <div>No repository information available.</div>;
  }

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Repository Details</h3>
        <p><strong>Full Name:</strong> {repoInfo.full_name}</p>
        <p><strong>Description:</strong> {repoInfo.description || 'No description provided'}</p>
        <p><strong>Stars:</strong> {repoInfo.stargazers_count}</p>
        <p><strong>Forks:</strong> {repoInfo.forks_count}</p>
        <p><strong>Open Issues:</strong> {repoInfo.open_issues_count}</p>
        <p><strong>Default Branch:</strong> {repoInfo.default_branch}</p>
      </div>
      
      <div>
        <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Repository Stats</h3>
        <p><strong>Created:</strong> {new Date(repoInfo.created_at).toLocaleDateString()}</p>
        <p><strong>Last Updated:</strong> {new Date(repoInfo.updated_at).toLocaleDateString()}</p>
        <p><strong>Language:</strong> {repoInfo.language || 'Not specified'}</p>
        <p><strong>License:</strong> {repoInfo.license ? repoInfo.license.name : 'No license'}</p>
      </div>
    </div>
  );
};

export default RepositoryInfo; 