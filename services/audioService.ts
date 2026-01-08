
import { Howl, Howler } from 'howler';

const sounds = {
  correct: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'] }), // Simple chime
  wrong: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'] }), // Buzzer
  click: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'] }), // Click
  win: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'] }), // Cheering
  
  // FIX: Switched back to active_storage URLs which are reliable and CORS-friendly
  message: new Howl({ 
    src: ['https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'], // Smartphone Notification Ping
    volume: 0.8 
  }), 
  sent: new Howl({ 
    src: ['https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'], // Bubble Pop
    volume: 0.6 
  }), 
  
  // Reaction Sound
  reaction: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'], volume: 0.6 }), 
  // distinct "Your Turn" notification
  turn: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1862/1862-preview.mp3'] }),
  // Countdown Tick
  tick: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], rate: 1.5 }), 
  // Game Start
  fight: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'] }),
  bgm: new Howl({ 
    src: ['https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3'], 
    loop: true,
    volume: 0.2
  })
};

export const playSound = (type: keyof typeof sounds) => {
  try {
    const sound = sounds[type];
    // Unlock WebAudio context if suspended (common in browsers)
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume();
    }
    sound.play();
  } catch (e) {
    console.error("Audio play error", e);
  }
};
