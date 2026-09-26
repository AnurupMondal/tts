/**
 * Common English words (roughly the top ~1,500 by frequency in chat-style text).
 * Used for language detection only. Words that are also common romanized Hindi
 * (to, me, main, do, are, bus...) are resolved by context in the detector.
 */
const WORDS = `
a able about above absolutely accept account across act action actually add address admin after afternoon again against age ago agree ahead air alive all allow almost alone along already alright also although always am amazing among amount an and angry animal annoying another answer any anybody anymore anyone anything anyway anywhere app apparently appear apply area are arent argue arm around arrive art article as ask asked asleep at attack attention audio aunt available avoid awake aware away awesome awful
baby back bad bag ball ban bank bar base basic basically bat battery be beat beautiful because become bed been before begin behind being believe below best better between big bigger bill birthday bit bite black blame block blood blue board body book boring born boss both bother bottle bottom bought box boy brain brand break breakfast bring broke broken brother brought buddy budget bug build building built bunch burn bus business busy but buy by bye
call called calling calm came camera can cancel cannot cant car card care careful case cash cat catch caught cause chance change channel character charge chat cheap check cheese chicken child choice choose chose city class clean clear click close closed clothes club code coffee cold college color come comes comfortable coming comment common company complete completely computer confused connect connection cool copy correct cost could couldnt count country couple course cousin cover crazy create cry cup cut cute
dad daily damn dance dark data date daughter day days dead deal dear decide decided deep definitely delete depends deserve design desk did didnt die difference different difficult dinner direct direction dirty discuss do doctor does doesnt dog doing dollar done dont door double doubt down download draw dream dress drink drive drop dude during
each early earn easy eat edit effort egg either else email empty end energy enjoy enough enter entire episode equal error especially even evening event ever every everybody everyone everything exactly exam example excited excuse exercise expect expensive experience explain extra eye eyes
face fact fail fair fall family famous fan far fast father fault favorite fear feel feeling feels fell felt few fight figure file fill film final finally find fine finish finished fire first fish fit fix floor follow food for forget forgot form forward found free fresh friday friend friends from front full fun funny future
gave general get gets getting girl girlfriend give given glad go god goes going gone gonna good goodnight got gotta great green ground group grow guess guy guys
had hair half hand handle hang happen happened happy hard has hate have havent having he head health hear heard heart heavy hell hello help her here hes hey hi high him his history hit hold holiday home homework honest honestly hope horrible hospital hot hour hours house how however huge human hungry hurry hurt husband
i ice idea if ill im imagine important in include information inside instead interested interesting internet into is isnt issue it its itself ive
job join joke just
keep kept key kid kids kill kind kinda knew know knowledge known
lady land language large last late later laugh law lazy lead learn least leave left leg less let lets letter level lie life light like liked line link list listen literally little live living lol long look looking looks lose lost lot lots loud love lovely low luck lucky lunch
mad made main major make makes making man manage many market married match matter may maybe me mean means meant meet meeting member memory mention message met method middle might mind mine minute minutes miss missed mistake mode model mom moment monday money month more morning most mother move movie much music must my myself
name near need needs never new news next nice night no nobody noise none nope normal not note nothing notice now number
of off offer office often oh ok okay old on once one online only open opinion option or order other others our out outside over own
page paid pain paper parent parents part party pass past pay people perfect perhaps person phone photo pick picture piece place plan play player playing please plus point police poor possible post power pretty price print private probably problem process project promise proper proud prove pull push put
question quick quickly quiet quit quite
rain random rank rate rather reach read ready real really reason receive recent record red relax remember reply report rest result return rich ride right ring road role room round rule run running
sad safe said same saturday save saw say saying says scared school score screen search season second see seem seems seen sell send sense sent serious seriously server set seven several share she shit shop short should show shower sick side sign simple since sing single sister sit situation size skill skip sleep slow small smart smell so social some somebody someone something sometimes somewhere son song soon sorry sort sound sounds space speak special spend sport stand start started state stay step still stop story straight strange stream street strong student study stuff stupid such sucks sudden suggest summer sunday super support suppose sure surprise sweet switch system
table take taken talk talking task taste team tell test text than thank thanks that thats the their them then there theres these they theyre thing things think thinking third this those though thought three through throw thursday till time tired to today together told tomorrow tonight too took top total totally touch town track train tried trip trouble true trust truth try trying tuesday turn two type
ugly uncle under understand unless until up update upon upset us use used useful user usual usually
video view visit voice vote
wait waiting wake walk wall want wanted wants war warm was wasnt watch watching water way we wear weather website wednesday week weekend weird welcome well went were werent what whatever whats when where whether which while white who whole whose why wife will win window wish with without woke woman won wonder wont word words work working world worried worry worse worst worth would wouldnt wow write wrong wrote
yeah year years yes yesterday yet you youll young your youre yours yourself
min mins sec secs hr hrs am pm
tension legend mood plan shock fresh mind break dinner lunch weekend online offline late early birthday message focus reload energy character
boring cute simple confirm topic solid pressure stress chill style dress shirt shoes gym workout diet medicine fever headache traffic metro auto
cab uber bike petrol ticket flight hotel vacation beach photo selfie status follow unfollow subscribe notification password login logout signup
website screenshot recording charging wire cable speaker volume network signal recharge balance discount sale delivery parcel package upi payment
paytm gpay loan emi bonus rent fees marks topper syllabus notes teacher madam maam principal lecture practical lab presentation submit deadline
shot shots aim insane crazy bore bored client manager intern shift hang slow fast high low down
`;

export const ENGLISH_COMMON: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean));

/** English morphology signals for words not in any list. */
export const ENGLISH_SUFFIXES = ['tion', 'sion', 'ing', 'ness', 'ment', 'able', 'ible', 'ful', 'less', 'ous', 'ly', 'ed', 'er', 'est', 'ize', 'ise', 'ity'] as const;
