/**
 * 여행 회화 정적 데이터: 카테고리 × 언어. 각 문구는 [현지어 원문, 한글 발음] 쌍이다.
 * 확신 없는 표기는 넣지 않는다(qa-reviewer 교차 확인 대상). 발음은 한글 근사 표기라 실제 성조/억양과는 다르다.
 * 태국어는 남성 "크랍"/여성 "카" 종결어를 붙여 말하면 더 공손하다(문구에는 넣지 않고 안내로 대체).
 */

export type PhraseCategory = 'greet' | 'food' | 'transport' | 'shop' | 'stay' | 'emergency'

export const PHRASE_CATEGORIES: Array<{ id: PhraseCategory; label: string; icon: string }> = [
  { id: 'greet', label: '인사', icon: '👋' },
  { id: 'food', label: '식당', icon: '🍽️' },
  { id: 'transport', label: '교통', icon: '🚕' },
  { id: 'shop', label: '쇼핑', icon: '🛍️' },
  { id: 'stay', label: '숙소', icon: '🏨' },
  { id: 'emergency', label: '긴급', icon: '🚨' },
]

export interface PhraseLanguage {
  code: string
  name: string
  tts: string
  note?: string
}

export const PHRASE_LANGUAGES: PhraseLanguage[] = [
  { code: 'en', name: '영어', tts: 'en-US' },
  { code: 'ja', name: '일본어', tts: 'ja-JP' },
  { code: 'zh-CN', name: '중국어(간체)', tts: 'zh-CN', note: '간체 기준입니다. 대만·홍콩은 번체를 씁니다.' },
  { code: 'th', name: '태국어', tts: 'th-TH', note: '말끝에 남성은 "크랍", 여성은 "카"를 붙이면 공손합니다.' },
  { code: 'vi', name: '베트남어', tts: 'vi-VN' },
  { code: 'es', name: '스페인어', tts: 'es-ES' },
  { code: 'fr', name: '프랑스어', tts: 'fr-FR' },
]

interface BasePhrase {
  id: string
  category: PhraseCategory
  ko: string
}

export const BASE_PHRASES: BasePhrase[] = [
  { id: 'hello', category: 'greet', ko: '안녕하세요.' },
  { id: 'thanks', category: 'greet', ko: '감사합니다.' },
  { id: 'sorry', category: 'greet', ko: '죄송합니다. / 실례합니다.' },
  { id: 'english', category: 'greet', ko: '영어 할 줄 아세요?' },

  { id: 'menu', category: 'food', ko: '메뉴판 주세요.' },
  { id: 'this', category: 'food', ko: '이걸로 주세요.' },
  { id: 'water', category: 'food', ko: '물 주세요.' },
  { id: 'check', category: 'food', ko: '계산해 주세요.' },

  { id: 'address', category: 'transport', ko: '이 주소로 가 주세요.' },
  { id: 'station', category: 'transport', ko: '역이 어디예요?' },
  { id: 'stophere', category: 'transport', ko: '여기서 세워 주세요.' },
  { id: 'toilet', category: 'transport', ko: '화장실이 어디예요?' },

  { id: 'howmuch', category: 'shop', ko: '얼마예요?' },
  { id: 'card', category: 'shop', ko: '카드 되나요?' },
  { id: 'tryon', category: 'shop', ko: '입어 봐도 돼요?' },
  { id: 'receipt', category: 'shop', ko: '영수증 주세요.' },

  { id: 'checkin', category: 'stay', ko: '체크인하고 싶어요.' },
  { id: 'luggage', category: 'stay', ko: '짐을 맡길 수 있나요?' },
  { id: 'wifi', category: 'stay', ko: '와이파이 비밀번호가 뭐예요?' },
  { id: 'checkout', category: 'stay', ko: '체크아웃은 몇 시예요?' },

  { id: 'help', category: 'emergency', ko: '도와주세요!' },
  { id: 'doctor', category: 'emergency', ko: '의사를 불러 주세요.' },
  { id: 'police', category: 'emergency', ko: '경찰을 불러 주세요.' },
  { id: 'passport', category: 'emergency', ko: '여권을 잃어버렸어요.' },
]

type Entry = [text: string, pronunciation: string]

const TRANSLATIONS: Record<string, Record<string, Entry>> = {
  en: {
    hello: ['Hello.', '헬로우'],
    thanks: ['Thank you.', '땡큐'],
    sorry: ["I'm sorry.", '아임 쏘리'],
    english: ['Do you speak English?', '두 유 스피크 잉글리시?'],
    menu: ['Can I have the menu, please?', '캔 아이 해브 더 메뉴, 플리즈?'],
    this: ["I'll have this, please.", '아윌 해브 디스, 플리즈'],
    water: ['Water, please.', '워터, 플리즈'],
    check: ['Check, please.', '체크, 플리즈'],
    address: ['Please take me to this address.', '플리즈 테이크 미 투 디스 어드레스'],
    station: ['Where is the station?', '웨어 이즈 더 스테이션?'],
    stophere: ['Please stop here.', '플리즈 스탑 히어'],
    toilet: ['Where is the restroom?', '웨어 이즈 더 레스트룸?'],
    howmuch: ['How much is this?', '하우 머치 이즈 디스?'],
    card: ['Do you accept credit cards?', '두 유 액셉트 크레딧 카드?'],
    tryon: ['Can I try this on?', '캔 아이 트라이 디스 온?'],
    receipt: ['Can I have a receipt, please?', '캔 아이 해브 어 리싯, 플리즈?'],
    checkin: ["I'd like to check in.", '아이드 라이크 투 체크 인'],
    luggage: ['Can I leave my luggage here?', '캔 아이 리브 마이 러기지 히어?'],
    wifi: ['What is the Wi-Fi password?', '왓 이즈 더 와이파이 패스워드?'],
    checkout: ['What time is check-out?', '왓 타임 이즈 체크아웃?'],
    help: ['Help!', '헬프!'],
    doctor: ['Please call a doctor.', '플리즈 콜 어 닥터'],
    police: ['Please call the police.', '플리즈 콜 더 폴리스'],
    passport: ['I lost my passport.', '아이 로스트 마이 패스포트'],
  },
  ja: {
    hello: ['こんにちは。', '콘니치와'],
    thanks: ['ありがとうございます。', '아리가토 고자이마스'],
    sorry: ['すみません。', '스미마센'],
    english: ['英語は話せますか？', '에이고와 하나세마스카?'],
    menu: ['メニューをください。', '메뉴오 구다사이'],
    this: ['これをください。', '고레오 구다사이'],
    water: ['お水をください。', '오미즈오 구다사이'],
    check: ['お会計をお願いします。', '오카이케이 오네가이시마스'],
    address: ['この住所までお願いします。', '고노 주쇼마데 오네가이시마스'],
    station: ['駅はどこですか？', '에키와 도코데스카?'],
    stophere: ['ここで止めてください。', '고코데 도메테 구다사이'],
    toilet: ['トイレはどこですか？', '토이레와 도코데스카?'],
    howmuch: ['いくらですか？', '이쿠라데스카?'],
    card: ['カードは使えますか？', '카도와 츠카에마스카?'],
    tryon: ['試着してもいいですか？', '시챠쿠시테모 이이데스카?'],
    receipt: ['レシートをください。', '레시토오 구다사이'],
    checkin: ['チェックインをお願いします。', '첵쿠인오 오네가이시마스'],
    luggage: ['荷物を預かってもらえますか？', '니모츠오 아즈캇테 모라에마스카?'],
    wifi: ['Wi-Fiのパスワードは何ですか？', '와이파이노 파스와도와 난데스카?'],
    checkout: ['チェックアウトは何時ですか？', '첵쿠아우토와 난지데스카?'],
    help: ['助けてください！', '타스케테 구다사이!'],
    doctor: ['医者を呼んでください。', '이샤오 욘데 구다사이'],
    police: ['警察を呼んでください。', '케이사츠오 욘데 구다사이'],
    passport: ['パスポートをなくしました。', '파스포토오 나쿠시마시타'],
  },
  'zh-CN': {
    hello: ['你好。', '니하오'],
    thanks: ['谢谢。', '씨에씨에'],
    sorry: ['对不起。', '뚜이부치'],
    english: ['你会说英语吗？', '니 후이 슈오 잉위 마?'],
    menu: ['请给我菜单。', '칭 게이 워 차이딴'],
    this: ['我要这个。', '워 야오 쩌거'],
    water: ['请给我水。', '칭 게이 워 수이'],
    check: ['买单。', '마이딴'],
    address: ['请带我去这个地址。', '칭 따이 워 취 쩌거 띠즈'],
    station: ['车站在哪里？', '처짠 짜이 나리?'],
    stophere: ['请在这里停车。', '칭 짜이 쩌리 팅처'],
    toilet: ['洗手间在哪里？', '시서우젠 짜이 나리?'],
    howmuch: ['多少钱？', '뚜오샤오 치엔?'],
    card: ['可以刷卡吗？', '크어이 슈아카 마?'],
    tryon: ['可以试穿吗？', '크어이 스촨 마?'],
    receipt: ['请给我发票。', '칭 게이 워 파피아오'],
    checkin: ['我要办理入住。', '워 야오 빤리 루주'],
    luggage: ['可以寄存行李吗？', '크어이 지춘 싱리 마?'],
    wifi: ['WiFi密码是多少？', '와이파이 미마 스 뚜오샤오?'],
    checkout: ['几点退房？', '지디엔 투이팡?'],
    help: ['救命！', '지우밍!'],
    doctor: ['请叫医生。', '칭 찌아오 이성'],
    police: ['请叫警察。', '칭 찌아오 징차'],
    passport: ['我的护照丢了。', '워 더 후짜오 띠우러'],
  },
  th: {
    hello: ['สวัสดี', '사왓디'],
    thanks: ['ขอบคุณ', '컵쿤'],
    sorry: ['ขอโทษ', '커톳'],
    english: ['คุณพูดภาษาอังกฤษได้ไหม', '쿤 풋 파싸 앙끄릿 다이 마이?'],
    menu: ['ขอเมนูหน่อย', '커 메누 너이'],
    this: ['เอาอันนี้', '아오 안니'],
    water: ['ขอน้ำเปล่าหน่อย', '커 남쁠라오 너이'],
    check: ['เช็คบิลหน่อย', '첵 빈 너이'],
    address: ['ไปที่อยู่นี้หน่อย', '빠이 티유 니 너이'],
    station: ['สถานีอยู่ที่ไหน', '싸타니 유 티나이?'],
    stophere: ['จอดตรงนี้หน่อย', '쩟 뜨롱니 너이'],
    toilet: ['ห้องน้ำอยู่ที่ไหน', '헝남 유 티나이?'],
    howmuch: ['อันนี้เท่าไหร่', '안니 타오라이?'],
    card: ['รับบัตรเครดิตไหม', '랍 밧 크레딧 마이?'],
    tryon: ['ลองได้ไหม', '렁 다이 마이?'],
    receipt: ['ขอใบเสร็จหน่อย', '커 바이쎗 너이'],
    checkin: ['ต้องการเช็คอิน', '떵깐 첵인'],
    luggage: ['ฝากกระเป๋าได้ไหม', '학 끄라빠오 다이 마이?'],
    wifi: ['รหัสไวไฟคืออะไร', '라핫 와이파이 크- 아라이?'],
    checkout: ['เช็คเอาท์กี่โมง', '첵아웃 끼 몽?'],
    help: ['ช่วยด้วย', '추어이 두어이'],
    doctor: ['ช่วยเรียกหมอหน่อย', '추어이 리악 머 너이'],
    police: ['ช่วยเรียกตำรวจหน่อย', '추어이 리악 땀루엇 너이'],
    passport: ['หนังสือเดินทางหาย', '낭쓰- 던탕 하이'],
  },
  vi: {
    hello: ['Xin chào.', '씬 짜오'],
    thanks: ['Cảm ơn.', '깜 언'],
    sorry: ['Xin lỗi.', '씬 로이'],
    english: ['Bạn có nói được tiếng Anh không?', '반 꼬 노이 드억 띠엥 아잉 콩?'],
    menu: ['Cho tôi xem thực đơn.', '쩌 또이 쌤 특던'],
    this: ['Cho tôi cái này.', '쩌 또이 까이 나이'],
    water: ['Cho tôi nước.', '쩌 또이 느억'],
    check: ['Tính tiền.', '띵 띠엔'],
    address: ['Làm ơn đưa tôi đến địa chỉ này.', '람 언 드어 또이 덴 디아 찌 나이'],
    station: ['Ga ở đâu?', '가 어 더우?'],
    stophere: ['Làm ơn dừng ở đây.', '람 언 증 어 더이'],
    toilet: ['Nhà vệ sinh ở đâu?', '냐 베 씽 어 더우?'],
    howmuch: ['Cái này giá bao nhiêu?', '까이 나이 자 바오 니에우?'],
    card: ['Tôi có thể thanh toán bằng thẻ không?', '또이 꼬 테 타인 또안 방 테 콩?'],
    tryon: ['Tôi có thể thử cái này không?', '또이 꼬 테 트 까이 나이 콩?'],
    receipt: ['Cho tôi hóa đơn.', '쩌 또이 화던'],
    checkin: ['Tôi muốn nhận phòng.', '또이 무온 년 퐁'],
    luggage: ['Tôi có thể gửi hành lý ở đây không?', '또이 꼬 테 그이 하인 리 어 더이 콩?'],
    wifi: ['Mật khẩu Wi-Fi là gì?', '멋 커우 와이파이 라 지?'],
    checkout: ['Mấy giờ trả phòng?', '머이 저 짜 퐁?'],
    help: ['Cứu tôi với!', '끄우 또이 버이!'],
    doctor: ['Làm ơn gọi bác sĩ.', '람 언 고이 박 씨'],
    police: ['Làm ơn gọi cảnh sát.', '람 언 고이 까잉 삿'],
    passport: ['Tôi bị mất hộ chiếu.', '또이 비 멋 호 찌에우'],
  },
  es: {
    hello: ['Hola.', '올라'],
    thanks: ['Gracias.', '그라시아스'],
    sorry: ['Disculpe.', '디스꿀뻬'],
    english: ['¿Habla inglés?', '아블라 잉글레스?'],
    menu: ['El menú, por favor.', '엘 메누, 뽀르 파보르'],
    this: ['Quiero esto, por favor.', '끼에로 에스또, 뽀르 파보르'],
    water: ['Agua, por favor.', '아구아, 뽀르 파보르'],
    check: ['La cuenta, por favor.', '라 꾸엔따, 뽀르 파보르'],
    address: ['Lléveme a esta dirección, por favor.', '예베메 아 에스따 디렉시온, 뽀르 파보르'],
    station: ['¿Dónde está la estación?', '돈데 에스따 라 에스따시온?'],
    stophere: ['Pare aquí, por favor.', '빠레 아끼, 뽀르 파보르'],
    toilet: ['¿Dónde está el baño?', '돈데 에스따 엘 바뇨?'],
    howmuch: ['¿Cuánto cuesta?', '꾸안또 꾸에스따?'],
    card: ['¿Aceptan tarjeta?', '아셉딴 따르헤따?'],
    tryon: ['¿Puedo probármelo?', '뿌에도 쁘로바르멜로?'],
    receipt: ['El recibo, por favor.', '엘 레시보, 뽀르 파보르'],
    checkin: ['Quisiera hacer el check-in.', '끼시에라 아세르 엘 체크인'],
    luggage: ['¿Puedo dejar mi equipaje aquí?', '뿌에도 데하르 미 에끼빠헤 아끼?'],
    wifi: ['¿Cuál es la contraseña del wifi?', '꾸알 에스 라 꼰뜨라세냐 델 위피?'],
    checkout: ['¿A qué hora es el check-out?', '아 께 오라 에스 엘 체크아웃?'],
    help: ['¡Ayuda!', '아유다!'],
    doctor: ['Llame a un médico, por favor.', '야메 아 운 메디꼬, 뽀르 파보르'],
    police: ['Llame a la policía, por favor.', '야메 아 라 뽈리시아, 뽀르 파보르'],
    passport: ['Perdí mi pasaporte.', '뻬르디 미 빠사뽀르떼'],
  },
  fr: {
    hello: ['Bonjour.', '봉주르'],
    thanks: ['Merci.', '메르시'],
    sorry: ['Excusez-moi.', '엑스뀌제 무아'],
    english: ['Parlez-vous anglais ?', '빠를레 부 앙글레?'],
    menu: ["La carte, s'il vous plaît.", '라 까르뜨, 씰 부 쁠레'],
    this: ["Je voudrais ceci, s'il vous plaît.", '쥬 부드레 스씨, 씰 부 쁠레'],
    water: ["De l'eau, s'il vous plaît.", '드 로, 씰 부 쁠레'],
    check: ["L'addition, s'il vous plaît.", '라디시옹, 씰 부 쁠레'],
    address: ["Emmenez-moi à cette adresse, s'il vous plaît.", '앙므네 무아 아 셋 아드레스, 씰 부 쁠레'],
    station: ['Où est la gare ?', '우 에 라 가르?'],
    stophere: ["Arrêtez-vous ici, s'il vous plaît.", '아레떼 부 이씨, 씰 부 쁠레'],
    toilet: ['Où sont les toilettes ?', '우 쏭 레 뚜알레뜨?'],
    howmuch: ['Combien ça coûte ?', '꽁비앙 사 꾸뜨?'],
    card: ['Vous acceptez les cartes ?', '부 작셉떼 레 까르뜨?'],
    tryon: ["Puis-je l'essayer ?", '쀠 쥬 레세이에?'],
    receipt: ["Le reçu, s'il vous plaît.", '르 르쒸, 씰 부 쁠레'],
    checkin: ["Je voudrais m'enregistrer.", '쥬 부드레 망르지스트레'],
    luggage: ['Puis-je laisser mes bagages ici ?', '쀠 쥬 레세 메 바가주 이씨?'],
    wifi: ['Quel est le mot de passe du Wi-Fi ?', '껠 레 르 모 드 빠스 뒤 와이파이?'],
    checkout: ['À quelle heure est le check-out ?', '아 껠 뢰르 에 르 체크아웃?'],
    help: ['Au secours !', '오 스꾸르!'],
    doctor: ["Appelez un médecin, s'il vous plaît.", '아쁠레 앙 메드생, 씰 부 쁠레'],
    police: ["Appelez la police, s'il vous plaît.", '아쁠레 라 뽈리스, 씰 부 쁠레'],
    passport: ["J'ai perdu mon passeport.", '줴 뻬르뒤 몽 빠스뽀르'],
  },
}

export interface Phrase {
  id: string
  category: PhraseCategory
  ko: string
  text: string
  pronunciation: string
}

export function getPhrases(lang: string, category: PhraseCategory): Phrase[] {
  const table = TRANSLATIONS[lang]
  if (!table) return []
  return BASE_PHRASES.filter((p) => p.category === category && table[p.id]).map((p) => ({
    id: p.id,
    category: p.category,
    ko: p.ko,
    text: table[p.id][0],
    pronunciation: table[p.id][1],
  }))
}
