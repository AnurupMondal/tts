/**
 * Common romanized Hindi words as typed in Indian Discord chats, including spelling variants.
 * Used only for *language detection* (is this token Hindi?). Pronunciation comes from the
 * transliteration engine, not from this list.
 */
const WORDS = `
aa aaj aaja aajao aao aap aapka aapke aapki aapko aapne aapse apne aaya aayi aaye aayega aayegi aaunga aaungi aaram aata aati aate aage aagey aakhir aas aasman
ab abe abey abhi abi accha acha achha achchha achhe ache acchi achi adha aadha aisa aise aisi ajeeb ajib akela alag albatta ander andar apna apne apni apan arre arey are arrey aur or aurat
baad baadal baje bje baar mahina mahine saal hafta hafte ghnte baat baate baaten baatein baatien bacha bache bachcha bachche bachna bachao badal bada bade badi bahar bahot bahut bahaut bohot bohat bht bhot bakwas bakchodi bakchod bakk bandh bana banao banaya banega bande banda bandi bas bs batao bata batana bataya bataunga bekar bekaar besharam bewakoof bewkoof bhaag bhag bhago bhej bhejo bheja bhejna dekhne dekhna chalein chale khelne sunne jaane aane karne bhai bhaiya bhaiyya bhaii bhaiyo bhaiyon bhau bhi bhook bhookh bhool bhul bhula bhoot bhot bilkul bina bol bolo bola boli bole bolna bolta bolti bolte bura bure buri bulao bula bulaya bus
chahiye chahie chaiye chahta chahti chal chala chali chale chalo chalna chalega chalegi chalta chalti chalte chup chupp chutti chhod chod chodo chhodo chhota chota chote choti chhoti cheez chiz chij chai chakkar chamak chaska chacha chachi
daal dal dard darr dar daro dekh dekho dekha dekhi dekhe dekhna dekhta dekhti dekhte dekhenge dena de do dedo dediya dega degi denge deta deti dete dhyan dhyaan dhang dhoondh dhund dikh dikha dikhao dikhta dil dimaag dimag din dino dino diya diye dono dobara dobaara door dost doston dosto dus duniya dukh dukaan
ek ekdam ekdum ekbar
faltu fir firse fikar fikr fark farak
gayab gaayab gaana gana gaali gali galat gaya gayi gaye gya gyi gye ghar ghanta ghante ghoom ghum ghumne gussa gusse gand
haan han haa hai he hain hei hy hae ho hoga hogi honge hona hota hoti hote hoon hu hun hoo hua hui hue hum humne hamara hamare hamari humko hume humein haath hath hatt hat hatao hawa hi hisaab hisab
idhar idar iska iske iski isko isse is ise inka inke inki inko unka unke unki unko unse usse uska uske uski usko us usne use uss
jaa ja jaao jao jaana jana jaata jata jaate jate jaati jati jaldi jab jabki jaisa jaise jaisi jaldi jaan jaanta janta jaanti janti jaunga jaungi jayega jaayega jayegi jagah jhoot jhooth jhoota jhooti jhakaas jeet jeeta jeetna jeet jeetenge jitna jitne jo joh jugaad jugad
ka kaa kab kb kabhi kabi kaha kahan kahaan kahi kahin kaisa kaise kaisi kese kesa kaam kam kal kaafi kafi kab kar kara karo karna karne karke karle karlo karke karta karti karte karega karegi karenge karunga karungi kardo karde kardi kardiya kari kiya kiye kia ki kitna kitne kitni kidhar kidar kis kise kisi kisko kiska kiski kiske kaun kon koi koii kuch kuchh kuch kch khana khaana khaa kha khaya khelo khel khela khele khelna khelta khelte khelenge khelega khelegi khatam khatm khush khushi khud kyu kyun kyon kyunki kyuki kya kyaa kyon kyuu ke ko kr kro krna krne krke krta krti krte krega krenge krunga kitab kitaab kutta kutte
laga lag lage lagi lagta lagti lagte lagega lagega lagao lao laya layi le lo lelo liya liye lena leta leti lete lega legi lenge log logo logon ladka ladki ladke ladkiyan lekin lkin laal lal lambi lamba lambe
maa maan mana mano manna maar mar maro mara mat matlab mtlb mai main maine mene mein me mera mere meri mera mujhe mjhe muje mujhko mujhse mujh mast milte milenge mil mila mile milna milega milo mushkil mummy mumy muh munh mehnat mauka mazaa maza maze mazak mazaak
na naa nahi nhi nahin nai ni nhn nahi naya naye nayi nai neeche niche nikal nikla nikle niklo nind neend nokri naukri
paani pani paas pas pata pta padh padhai padhna padega padegi pagal pgl pahle pehle pehli pehla phir fir pyaar pyar poocha pucha puchh pooch poora pura puri pure pakka pakad pakdo par pe peeche piche paisa paise
raat rat raha rha rahi rhi rahe rhe rahega rahegi rahenge rakh rakho rakha rakhna rasta raasta ruk ruko rukja rukjao rukna roz roj rona ro rone
saath sath saala sala saale sale sab sb sabhi sabko sach sahi samajh samjh samjha samjho samajhna sambhal sapna se sirf soch socha socho sona so soja sojao sun suno suna sunna sunao shaam sham shayad sakta sakti sakte sakega sakenge sheher shehar seedha sidha sust suar sukh
tab tabhi tak tk taki tera tere teri tu tune tum tumne tumhara tumhare tumhari tumko tumhe tumhein tujhe tjhe tuje tujhko tha thi the tho thoda thodi thode thak thaka thik theek thk toh to tod todo toota tuta tyar taiyaar taiyar
upar uppar ulta
wah waah waala wala wali wale waha wahan wahaan wapas vapas waise vaise woh wo vo voh warna varna
yaar yar yaaro yaaron yaha yahan yahaan yahi yeh ye yehi yaad yad
zara jara zyada jyada zindagi zinda zaroor jaroor zabardast jabardast
`;

export const HINDI_ROMAN: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean));
