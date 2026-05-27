const axios = require('axios');

const port = process.env.PORT || 5002;
const url = `http://localhost:${port}/api/simulate`;

const testScenarios = [
  {
    studentName: 'Aarav Sharma',
    groupName: 'Edoofa - Aarav Sharma',
    senderType: 'Student/Parent',
    senderName: 'Aarav Sharma'
  },
  {
    studentName: 'Aarav Sharma',
    groupName: 'Edoofa - Aarav Sharma',
    senderType: 'Edoofa Team',
    senderName: 'Mentor Raghav'
  },
  {
    studentName: 'Blessing Tembo',
    groupName: 'Edoofa - Blessing Tembo',
    senderType: 'Student/Parent',
    senderName: 'Blessing Tembo'
  },
  {
    studentName: 'Chisom Okoro',
    groupName: 'Edoofa - Chisom Okoro',
    senderType: 'Student/Parent',
    senderName: 'Chisom\'s Father'
  },
  {
    studentName: 'Blessing Tembo',
    groupName: 'Edoofa - Blessing Tembo',
    senderType: 'Edoofa Team',
    senderName: 'Mentor Raghav'
  }
];

async function seedDatabase() {
  console.log('==================================================================');
  console.log('EDOOFA VOICEFLOW PIPELINE - SEEDING ENGINE');
  console.log('==================================================================');
  console.log(`Connecting to server endpoint: ${url}`);
  console.log('Seeding 5 highly realistic, multi-turn student voice notes...');
  console.log('------------------------------------------------------------------');

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    try {
      console.log(`[${i + 1}/5] Injecting Voice Note for student: ${scenario.studentName}...`);
      const response = await axios.post(url, scenario);
      if (response.data.success) {
        const item = response.data.data;
        console.log(`      -> SUCCESS: Logged daily VN #${item.vnNumber} (${item.senderType})`);
        console.log(`      -> Transcript: "${item.transcript.substring(0, 60)}..."`);
      }
    } catch (err) {
      console.error(`      -> ERROR: Injection failed for ${scenario.studentName}. Is the server running?`, err.message);
    }
    // Small delay between injections
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  console.log('------------------------------------------------------------------');
  console.log('Seeding process complete! Refresh your dashboard to view the data.');
  console.log('==================================================================');
}

// Check if run directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
