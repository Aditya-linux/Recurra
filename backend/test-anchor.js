const axios = require('axios');
const jwt = require('jsonwebtoken');

async function run() {
  const token = jwt.sign({ walletAddress: 'G...', role: 'user' }, 'mock-secret', { expiresIn: '1h' });
  try {
    const res = await axios.post('http://localhost:3001/api/v1/anchor/interactive', {
      domain: 'testanchor.stellar.org',
      action: 'deposit',
      assetCode: 'USDC',
      account: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      jwtToken: 'mock-sep10-jwt'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error('Error Status:', err.response?.status);
    console.error('Error Data:', err.response?.data);
  }
}

run();
