import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ManualInstallationHelp() {
  const [installationId, setInstallationId] = useState('');
  const navigate = useNavigate();
  
  const handleContinue = () => {
    if (installationId) {
      localStorage.setItem('github_installation_id', installationId);
      navigate('/installation/complete');
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Continue Installation</h2>
        <p className="mb-4">
          If you're stuck on the GitHub installation page, copy the installation ID from the URL
          (it looks like a number, e.g., 61620318) and paste it below:
        </p>
        
        <div className="mb-4">
          <input
            type="text"
            value={installationId}
            onChange={(e) => setInstallationId(e.target.value)}
            placeholder="Installation ID from URL"
            className="w-full p-2 border rounded"
          />
        </div>
        
        <button
          onClick={handleContinue}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={!installationId}
        >
          Continue Installation
        </button>
      </div>
    </div>
  );
}

export default ManualInstallationHelp; 