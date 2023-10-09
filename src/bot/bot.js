import _ from 'lodash';

import { wax, execTransaction } from '../core/wax';
import log from '../utils/log';
import fetchWaxAccount from '../core/fetchWaxAccount';
import ACCOUNT_CAPABILITIES from '../configs/ACCOUNT_CAPABILITIES';

// novopangea
import playGameCalcNextAction from '../novopangea/playGameCalcNextAction';

// core 
import claimWaxRewardCalcNextAction from '../core/claimWaxRewardCalcNextAction';

let isBotStarted = false;
const GAMES = {
  // novopangea
  NP_PLAY_GAME: {
    duration: 20 * 1000,
    validatorName: 'novopangea_play_game',
    calcNextAction: playGameCalcNextAction,
  },

  // wax
  CLAIM_WAX_REWARD: {
    duration: 180 * 1000,
    validatorName: 'claim_wax_reward',
    calcNextAction: claimWaxRewardCalcNextAction,
  },
};

const startGameBot = ({ calcNextAction, gameSettings }) => {
  gameSettings.interval = setInterval(async () => {
    const durationFromLastExec = Date.now() - gameSettings.lastTime;
    if (durationFromLastExec < 5 * 60 * 1000 && gameSettings.isInProgress) {
      return;
    }
    gameSettings.lastTime = Date.now();
    gameSettings.isInProgress = true;
    let signal;
    try {
      const account = await fetchWaxAccount({
        accountName: wax.userAccount,
      });
      if (account.cpuLoad > 0.98) {
        log({
          project: gameSettings.name,
          message: `<cpu_limit> There is no available CPU. CPU usage is ${_.round(
            account.cpuLoad * 100,
          )}%`,
          info: account,
        });
        gameSettings.isInProgress = false;
        return;
      }

      signal = await calcNextAction({
        accountName: wax.userAccount,
        gameSettings,
      });
      log({
        project: gameSettings.name,
        message: `<${signal.action}> ${signal.message}`,
        info: signal,
      });
      if (signal.isMultipleTransactions) {
        for (let i = 0; i < signal.actions.length; i++) {
          await execTransaction({
            project: gameSettings.name,
            actions: signal.actions[i],
          });  
        }
      } else {
        await execTransaction({
          project: gameSettings.name,
          actions: signal.actions,
        });
      }
    } catch (err) {
      log({
        project: gameSettings.name,
        message: err.message,
        info: err,
      });
    }
    gameSettings.isInProgress = false;
  }, gameSettings.duration);
};

const stopGameBot = ({ gameSettings }) => {
  clearInterval(gameSettings.interval);
  gameSettings.interval = null;
  gameSettings.isInProgress = false;
  gameSettings.lastTime = Date.now();
};

export const startBot = () => {
  if (wax.userAccount == null) {
    console.log('Account is not logged in');
    return;
  }
  if (isBotStarted) {
    console.log('Bot is already started');
    return;
  }
  isBotStarted = true;

  const accountCapabilities = ACCOUNT_CAPABILITIES[wax.userAccount];

  _(GAMES)
    .forEach((gameSettings, name) => {
      if (!accountCapabilities[gameSettings.validatorName]) {
        console.log(`Capability ${name} turned off for ${wax.userAccount} account`);
        return;
      }
    
      console.log(`Start ${name} bot ...`);

      startGameBot({
        calcNextAction: gameSettings.calcNextAction,
        gameSettings: {
          ...gameSettings,
          isInProgress: false,
          interval: null,
          name,
          lastTime: Date.now(),
        },
      });
    });
};

export const stopBot = () => {
  if (!isBotStarted) {
    console.log('Bot is already stopped');
    return;
  }

  isBotStarted = false;

  _(GAMES)
    .forEach((gameSettings, name) => {
      console.log(`Canceled ${name} bot`);
      stopGameBot({
        gameSettings,
      });
    });
};