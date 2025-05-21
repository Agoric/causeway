import { useState } from 'react';
import { TimeRange } from '../types';
import {
  createNeo4jDriver,
  formatUnixTimestamp,
  generateNeo4jGraph,
  processLogFile,
} from '../helpers';

const LogImporter = () => {
  const [uri, setUri] = useState('bolt://localhost:7687');
  const [username, setUsername] = useState('neo4j');
  const [password, setPassword] = useState('secretpassword'); // Default password for convenience
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    min: null,
    max: null,
  });

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(
        `Selected file: ${e.target.files[0].name} (${(
          e.target.files[0].size /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );
    }
  };

  const handleImport = async () => {
    if (!file) {
      setStatus('Please select a log file');
      return;
    }

    setIsLoading(true);
    setStatus('Processing log file...');

    let driver;
    try {
      const data = (await processLogFile(file, setStatus)) as {
        vats: any[];
        deliveries: any[];
        syscalls: any[];
        blocks: any[];
        promises: any[];
      };

      setStatus('Connecting to Neo4j...');
      driver = await createNeo4jDriver(uri, username, password);
      const session = driver.session();

      setStatus('Generating Neo4j graph...');
      await generateNeo4jGraph(data, session);

      await session.close();
      setStatus('Successfully imported log data into Neo4j');

      let minTime = Number.MAX_VALUE;
      let maxTime = 0;

      data.deliveries.forEach((item) => {
        if (item.time) {
          const time = parseFloat(item.time);
          if (!isNaN(time)) {
            minTime = Math.min(minTime, time);
            maxTime = Math.max(maxTime, time);
          }
        }
      });

      data.syscalls.forEach((item) => {
        if (item.time) {
          const time = parseFloat(item.time);
          if (!isNaN(time)) {
            minTime = Math.min(minTime, time);
            maxTime = Math.max(maxTime, time);
          }
        }
      });

      if (minTime !== Number.MAX_VALUE && maxTime !== 0) {
        setTimeRange({ min: minTime, max: maxTime });
      }
    } catch (error) {
      console.error('Error importing logs:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      if (driver) {
        await driver.close();
      }
      setIsLoading(false);
    }
  };

  return (
    <div className='log-importer'>
      <h3>Import Log File to Neo4j</h3>

      <div className='form-group'>
        <label>Neo4j URI:</label>
        <input
          type='text'
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder='bolt://localhost:7687'
        />
        <small className='form-text'>
          For local Neo4j use: bolt://localhost:7687
        </small>
      </div>

      <div className='form-group'>
        <label>Username:</label>
        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='neo4j'
        />
      </div>

      <div className='form-group'>
        <label>Password:</label>
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='Your password'
        />
      </div>

      <div className='form-group'>
        <label>Log File (jsonl):</label>
        <input
          type='file'
          onChange={handleFileChange}
          accept='.json,.jsonl,.log'
        />
        <small className='form-text'>
          Select a JSON Lines log file with one JSON object per line
        </small>
      </div>

      <button onClick={handleImport} disabled={isLoading || !password || !file}>
        {isLoading ? 'Importing...' : 'Import Log to Neo4j'}
      </button>

      {status && (
        <div
          className={`status-message ${
            status.includes('error') || status.includes('Error') ? 'error' : ''
          }`}>
          {status}
        </div>
      )}

      {timeRange.min && (
        <div className='time-range-info'>
          <h4>Time Range Information</h4>
          <p>To view this data in the diagram tab, use these timestamps:</p>
          <ul>
            <li>
              <strong>Start time:</strong> {timeRange.min}
            </li>
            <li>
              <strong>End time:</strong> {timeRange.max}
            </li>
            <li>
              <strong>Start date:</strong> {formatUnixTimestamp(timeRange.min)}
            </li>
            <li>
              <strong>End date:</strong>{' '}
              {formatUnixTimestamp(timeRange.max as number)}
            </li>
          </ul>
        </div>
      )}

      <div className='troubleshooting'>
        <h4>Troubleshooting</h4>
        <ul>
          <li>Make sure your Neo4j database is running</li>
          <li>
            For local installations, use <code>bolt://localhost:7687</code>
          </li>
          <li>Check that username and password are correct</li>
          <li>
            The log file should be in JSONL format (one JSON object per line)
          </li>
          <li>
            After importing, switch to the &quot;View Diagram&quot; tab to
            visualize the data
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LogImporter;
