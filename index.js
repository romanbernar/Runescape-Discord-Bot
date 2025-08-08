// V1.5 features text formating, such as prettying quest point activity and formating numbers
const {google} = require('googleapis');
const {promisify} = require('util');
const Discord = require('discord.js');
require('dotenv').config();
console.log(process.env)

const SHEET_ID = process.env.SHEET_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TOKEN = process.env.TOKEN;
const saved_sheet = "saved_sheet";
const updated_sheet = "updated_sheet";
// Edit SHEET_ID with id of spreadsheet to post.
// edit guild and channels with the correct Discord ids.
// WARNING: Be sure that "Sheet2", aka the sheet that captures the most recent changes to the activity log, has data in cells G2:G112.
exports.results = (req, res) => {
  google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }).then( // get values from saved sheet and updated shhet
    auth => {
    const api = google.sheets({ version: 'v4', auth });
    const getLog = promisify(api.spreadsheets.values.get.bind(api.spreadsheets.values));
   

    return Promise.all( [ getLog({ spreadsheetId: SHEET_ID,
    range: `${saved_sheet}!A2:A112`}), 
    getLog({ spreadsheetId: SHEET_ID, range: `${saved_sheet}!D2:D112`}), 
    getLog({ spreadsheetId: SHEET_ID, range: `${updated_sheet}!G2:G112`}), auth]);
  
  }).then(([names, summary, discordLog, auth]) => {
    // Combine names and activity
    // discordLog is the log posted to Discord, new Log is the current log as available on Runescape's site
    const api = google.sheets({ version: 'v4', auth });
    let newLog = [];
    const textLimit = 200; //number of characters per message
    newLog = names.data.values.map((element, index ) => {
    const str = element + ' ' + summary.data.values[index]; //combines name and activity
    if(str.length < textLimit) {
           return [str];
    } else {
      return [str.substring(0,textLimit) + '...'];
      }
    });
            // Creates array that can be used to update log to new values
      discordLog.data.values.forEach(function(element,index) {
        if(element.toString() === newLog[index]) {
        // The value hasn't been updated, so it isn't included
        discordLog.data.values[index] = '#N/A'; 
        } else {
        // updates discordLog with current values
        discordLog.data.values[index] = newLog[index];
        }
      });
    let myObject = {values: discordLog.data.values};
      const updateLog = promisify(api.spreadsheets.values.update.bind(api.spreadsheets.values));
 
    const request = {spreadsheetId: SHEET_ID, 
      range: `${updated_sheet}!G2:G112`, valueInputOption: 'RAW', resource: myObject};
    const updateOutput = updateLog(request);
      return myObject.values;

      }).then(out => {
const client = new Discord.Client();
if (out.length) {
              
              // Adventure log is split up to override 
              //the Discord text/message limit. 
               const sends = 20; // amount to divide messages by
              let outLength = Math.round(out.length/sends) - 1;

              //removes non-entries
              const activityLog = simplifyArr(); 
              client.on('ready', () => {
    console.log("Connected as " + client.user.tag);
    
                // Send messages to channel   
                //const guild = client.guilds.get('631590419276365824');
                const myChannel = client.channels.get(CHANNEL_ID);
                sendMessage(myChannel);
                console.log('Message is sent. Terminating.');
                 });

//Send message in Markdown.            
function sendMessage(myChannel) {
  for(i=0;i<outLength;i++) {
    myChannel.send(`\`\`\`CSS
${activityLog[i]}
    \`\`\``);
  }
}                 
function simplifyArr() { //stringifies and removes non-text
  let arr = [];
  let simplifiedArr = out.filter(ele => {
        const str = ele.toString();
    return (str.indexOf('#N/A') == -1 && str.indexOf('Loading...') == -1);
  });

  // Add 
  outLength = Math.round(simplifiedArr.length/outTimes);
  for(let i = 1; i<outLength+1;i++) {
    arr.push(simplifiedArr.slice((i-1)*outTimes,i*outTimes).join("\n"));
  }

  arr.push(simplifiedArr.slice(outLength*outTimes+1,simplifiedArr.length).join("\n"))
  arr.forEach( (ele,i) => { //formats numbers in string
  arr[i] = formatNumber(ele);
  });

 // Function for formatting number to use millions and billions
  function formatNumber(str) { 
    let formatted = 0;
    let arr = str.split(' ');
    //Find elements that need formating
    let largeNumbers = arr.filter(ele => { 
      return ele.indexOf('0') > 0 && ele >= 1e6;
    });

    // Convert numbers to use millions (M) and billions (b)
    largeNumbers.forEach(ele => { 
      if(ele <= 1e9 && ele >= 1e6) {
        formatted = parseInt(ele) / 1e6 + 'M';
      } else if (ele >= 1e9) {
        formatted = parseInt(ele) / 1e9 + 'b';
      }
      arr[arr.indexOf(ele)] = formatted;
    });
    return arr.join(' ');
}

  return arr;
}
                

client.login(TOKEN);
return activityLog;
            }          
}).then(out => {
res.status(200).send({ out });
      })
.catch(err => {
      res.status(500).send({ err });
    })
}