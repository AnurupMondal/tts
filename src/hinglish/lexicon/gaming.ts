/**
 * Gaming / Discord / tech vocabulary that Indian players say in English even mid-Hindi sentence.
 * These always stay in Latin script ("bhai game throw kr rha hai" → "भाई game throw कर रहा है").
 */
const WORDS = `
game games gaming gamer match ranked unranked rank lobby queue server servers discord discord's vc voice mic mute unmute deafen stream streaming streamer live
valorant val csgo cs cs2 counter strike pubg bgmi freefree freefire ff fortnite minecraft mc gta gta5 apex overwatch dota lol league cod warzone roblox among amongus rocket fifa pes clash coc clashroyale
clutch carry carried throw throwing thrower feed feeding noob noobs pro op nerf buff buffed nerfed meta build loadout spawn respawn camp camper camping snipe sniper rush push peek flank rotate rotation defuse plant spike bomb site
ace kill kills death deaths assist headshot hs one-tap onetap spray aim aimbot wallhack hack hacker hacks cheat cheater report ban banned kick kicked afk brb gg ggs wp ez rip nt gl hf
lag lagging ping fps frame frames drop drops crash crashed bug glitch patch update download install uninstall setting settings sensitivity sens crosshair keyboard mouse headset headphone controller console pc laptop mobile phone gpu cpu rtx gtx ram ssd monitor wifi internet net data
team teammate teammates squad duo solo trio party invite join leave level xp skin skins battlepass pass crate loot drop reward grind grinding tournament scrim scrims round rounds overtime
bot bots admin mod mods role roles channel ping emoji meme memes nitro boost dm dms reel reels insta instagram youtube yt video short shorts edit post story whatsapp
haha hahaha hehe lol lmao bro bruh dude sis ok okay okk k hmm hmmm lol lmao lmfao rofl omg wtf idk idc ikr btw imo tbh fr ngl nvm np ty thx thanks pls plz please sorry sry yes yeah yep nope no hi hello hey bye gn gm
laptop charger battery office college school exam class tuition assignment project meeting boss salary job interview
movie series episode season netflix hotstar prime anime
`;

export const GAMING_TERMS: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean));
