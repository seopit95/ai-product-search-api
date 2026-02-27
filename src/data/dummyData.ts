export const dummyData = [
  // 1~10 밀폐용기
  { id: 1, payload: { name: "락앤락 클래식 밀폐용기 3종 세트", brand: "락앤락", category: "밀폐용기", price: 18900,
      description: "기본형 반찬통, 도시락통 세트. 냉장 보관, 전자레인지 데움, 기본 밀폐로 국물이나 냄새 새는 것을 줄인 BPA FREE 보관용기.",
      image_url: "https://locknlock2.cdn-nhncommerce.com/data/editor/goods/HFL101_8.jpg",
      tags: [] }},

  // { id: 2, payload: { name: "락앤락 비스프리 모듈러 1L", brand: "락앤락", category: "밀폐용기", price: 7900,
  //     description: "투명 트라이탄 소재의 1L 보관용기. 냉장/냉동 보관에 좋고 내용물 확인이 쉬운 반찬통/식재료통.",
  //     tags: [] }},

  // { id: 3, payload: { name: "락앤락 김치통 5L", brand: "락앤락", category: "밀폐용기", price: 12900,
  //     description: "김치 보관 전용 대용량 5L 용기. 냄새 배임을 줄이고 김치, 장아찌, 절임류 보관에 적합한 김치통/발효통.",
  //     tags: [] }},
  //
  // { id: 4, payload: { name: "락앤락 내열 유리 밀폐용기 원형", brand: "락앤락", category: "밀폐용기", price: 11900,
  //     description: "내열 유리 재질의 원형 용기. 오븐/전자레인지 사용 가능(뚜껑 제외 가정). 남은 음식 보관 후 데워 먹기 좋은 글라스 밀폐용기.",
  //     tags: [] }},
  //
  // { id: 5, payload: { name: "락앤락 이유식 밀폐용기 세트", brand: "락앤락", category: "밀폐용기", price: 22900,
  //     description: "아기 이유식/간식 소분 보관용. BPA FREE 소재로 안전성 강조, 냉동 소분 후 해동/데움에 편한 이유식통 세트.",
  //     tags: [] }},
  //
  // { id: 6, payload: { name: "락앤락 스팀 전자레인지 용기", brand: "락앤락", category: "밀폐용기", price: 13900,
  //     description: "전자레인지로 찜/데움할 때 스팀이 빠지는 구조. 촉촉하게 데우기, 간단 찜요리(야채/만두/해산물 데움)에 사용 가능한 전자레인지 전용 용기.",
  //     tags: [] }},
  //
  // { id: 7, payload: { name: "락앤락 냉동 전용 밀폐용기", brand: "락앤락", category: "밀폐용기", price: 9900,
  //     description: "냉동실 보관에 특화된 보관용기. 냉동밥, 반찬 소분, 식재료 얼리기에 적합한 냉동용 밀폐용기.",
  //     tags: [] }},
  //
  // { id: 8, payload: { name: "락앤락 정사각 밀폐용기 2L", brand: "락앤락", category: "밀폐용기", price: 10900,
  //     description: "2L 대용량 식재료통. 정사각 형태로 수납이 좋고, 야채/과일/가루류/반찬 대량 보관에 적합.",
  //     tags: [] }},
  //
  // { id: 9, payload: { name: "락앤락 냉장고 정리 용기 세트", brand: "락앤락", category: "밀폐용기", price: 34900,
  //     description: "냉장고 수납/정리용 트레이형 보관용기 세트. 칸 정리, 식재료 정돈, 냉장고 정리템으로 사용.",
  //     tags: [] }},
  //
  // { id: 10, payload: { name: "락앤락 곡물 보관 밀폐용기", brand: "락앤락", category: "밀폐용기", price: 15900,
  //     description: "쌀·잡곡·콩·견과류 보관용 곡물통. 습기/벌레 유입을 줄여 장기 보관에 적합한 쌀통/잡곡통 대체용기.",
  //     tags: [] }},
  //
  // // 11~20 텀블러 / 보온병
  // { id: 11, payload: { name: "락앤락 메트로 텀블러 475ml", brand: "락앤락", category: "텀블러", price: 27900,
  //     description: "475ml 휴대용 보온/보냉 텀블러. 출근/카페 테이크아웃용으로 슬림한 사이즈.",
  //     tags: [] }},
  //
  // { id: 12, payload: { name: "락앤락 스텐 빨대 텀블러", brand: "락앤락", category: "텀블러", price: 31900,
  //     description: "스테인리스 바디 + 빨대 포함 텀블러. 아이스 음료, 운동할 때 마시기 편한 빨대컵 스타일.",
  //     tags: [] }},
  //
  // { id: 13, payload: { name: "락앤락 데일리 보온병 500ml", brand: "락앤락", category: "보온병", price: 24900,
  //     description: "500ml 보온병/보냉병. 뜨거운 물, 차, 커피 보온 및 냉음료 보냉에 적합.",
  //     tags: [] }},
  //
  // { id: 14, payload: { name: "락앤락 슬림 보온 텀블러", brand: "락앤락", category: "텀블러", price: 29900,
  //     description: "가방에 넣기 좋은 슬림 보온 텀블러. 직장인 출근길, 차량 컵홀더 사용에 적합.",
  //     tags: [] }},
  //
  // { id: 15, payload: { name: "락앤락 원터치 보온병", brand: "락앤락", category: "보온병", price: 26900,
  //     description: "한 손으로 여닫는 원터치 보온병. 운전/운동 중에도 편리하게 마시는 물통 형태의 보온병.",
  //     tags: [] }},
  //
  // { id: 16, payload: { name: "락앤락 스포츠 텀블러", brand: "락앤락", category: "텀블러", price: 33900,
  //     description: "야외활동/운동용 대용량 텀블러. 헬스, 등산, 캠핑에서 물 많이 마실 때 쓰는 스포츠 물통 느낌.",
  //     tags: [] }},
  //
  // { id: 17, payload: { name: "락앤락 키즈 보온병", brand: "락앤락", category: "보온병", price: 21900,
  //     description: "아이 전용 키즈 보온병. 어린이집/유치원 등원용, 안전 설계와 휴대성을 강조.",
  //     tags: [] }},
  //
  // { id: 18, payload: { name: "락앤락 트래블 텀블러", brand: "락앤락", category: "텀블러", price: 35900,
  //     description: "여행/출장용 보온 텀블러. 장거리 이동, 차 안, 공항 대기 시 커피/차 보온에 적합.",
  //     tags: [] }},
  //
  // { id: 19, payload: { name: "락앤락 커피 전용 텀블러", brand: "락앤락", category: "텀블러", price: 28900,
  //     description: "커피 향 보존에 초점을 둔 텀블러. 원두커피/아메리카노 테이크아웃용으로 적합.",
  //     tags: [] }},
  //
  // { id: 20, payload: { name: "락앤락 프리미엄 보온병", brand: "락앤락", category: "보온병", price: 39900,
  //     description: "프리미엄 스테인리스 보온병. 내구성/보온보냉 성능을 강조한 고급 라인.",
  //     tags: [] }},
  //
  // // 21~30 도시락 / 물병
  // { id: 21, payload: { name: "락앤락 전자레인지 도시락", brand: "락앤락", category: "도시락", price: 15900,
  //     description: "전자레인지 데움 가능한 도시락통. 직장 점심, 남은 반찬 담아가기, 간편 식사 준비용.",
  //     tags: [] }},
  //
  // { id: 22, payload: { name: "락앤락 직장인 도시락 세트", brand: "락앤락", category: "도시락", price: 24900,
  //     description: "직장인 점심용 도시락 세트. 반찬 칸 나눔, 소분, 주간 밀프렙(식단 준비)에 적합.",
  //     tags: [] }},
  //
  // { id: 23, payload: { name: "락앤락 키즈 도시락", brand: "락앤락", category: "도시락", price: 19900,
  //     description: "아이 전용 소형 도시락. 유치원/어린이집 소풍, 간식 담기 좋은 사이즈.",
  //     tags: [] }},
  //
  // { id: 24, payload: { name: "락앤락 에코 물병 700ml", brand: "락앤락", category: "물병", price: 8900,
  //     description: "700ml 트라이탄 물병. 가볍고 튼튼해 헬스/사무실/학교에서 데일리 물통으로 사용.",
  //     tags: [] }},
  //
  // { id: 25, payload: { name: "락앤락 스포츠 물병 1L", brand: "락앤락", category: "물병", price: 12900,
  //     description: "1L 대용량 스포츠 물병. 운동할 때 수분 보충, 헬스장 물통으로 적합.",
  //     tags: [] }},
  //
  // { id: 26, payload: { name: "락앤락 접이식 물병", brand: "락앤락", category: "물병", price: 14900,
  //     description: "휴대가 간편한 접이식 물병. 캠핑/등산/여행에서 부피를 줄여 들고 다니기 좋음.",
  //     tags: [] }},
  //
  // { id: 27, payload: { name: "락앤락 유리 물병", brand: "락앤락", category: "물병", price: 16900,
  //     description: "유리 재질 물병. 플라스틱 냄새 없이 물/차를 마시기 좋고 환경 친화적인 선택.",
  //     tags: [] }},
  //
  // { id: 28, payload: { name: "락앤락 스트로 물병", brand: "락앤락", category: "물병", price: 13900,
  //     description: "빨대형(스트로) 물병. 한 손으로 빨아 마시기 쉬워 운동/아이 물병으로도 활용.",
  //     tags: [] }},
  //
  // { id: 29, payload: { name: "락앤락 미니 물병", brand: "락앤락", category: "물병", price: 7900,
  //     description: "가방에 쏙 들어가는 미니 물병. 짧은 외출, 회사 책상, 아이 물병 보조용.",
  //     tags: [] }},
  //
  // { id: 30, payload: { name: "락앤락 프리미엄 물병", brand: "락앤락", category: "물병", price: 22900,
  //     description: "고급 마감의 프리미엄 물병. 선물용/사무실용 데일리 물통.",
  //     tags: [] }},
  //
  // // 31~50 프라이팬 / 냄비
  // { id: 31, payload: { name: "락앤락 데일리 프라이팬 28cm", brand: "락앤락", category: "프라이팬", price: 34900,
  //     description: "28cm 논스틱 코팅 후라이팬/프라이팬. 계란후라이, 볶음, 구이 등 기본 조리에 쓰는 팬.",
  //     tags: [] }},
  //
  // { id: 32, payload: { name: "락앤락 IH 프라이팬", brand: "락앤락", category: "프라이팬", price: 39900,
  //     description: "IH/인덕션 겸용 프라이팬. 가스/하이라이트/인덕션에서 사용 가능한 인덕션 팬.",
  //     tags: [] }},
  //
  // { id: 33, payload: { name: "락앤락 미니 프라이팬", brand: "락앤락", category: "프라이팬", price: 24900,
  //     description: "1인 가구용 소형 프라이팬. 간단한 계란/소시지/팬케이크 조리에 적합.",
  //     tags: [] }},
  //
  // { id: 34, payload: { name: "락앤락 웍 팬 30cm", brand: "락앤락", category: "프라이팬", price: 45900,
  //     description: "볶음 요리에 적합한 30cm 웍팬. 볶음밥, 야채볶음, 중국요리 느낌의 깊은 팬.",
  //     tags: [] }},
  //
  // { id: 35, payload: { name: "락앤락 스테인리스 냄비", brand: "락앤락", category: "냄비", price: 49900,
  //     description: "스테인리스 냄비. 찌개/국/라면/파스타 등 기본 조리에 쓰는 스텐 냄비.",
  //     tags: [] }},
  //
  // { id: 36, payload: { name: "락앤락 IH 냄비 세트", brand: "락앤락", category: "냄비", price: 69900,
  //     description: "인덕션(IH) 호환 냄비 세트. 국/찌개/탕/찜 등 다양한 조리에 맞춘 세트 구성.",
  //     tags: [] }},
  //
  // { id: 37, payload: { name: "락앤락 미니 냄비", brand: "락앤락", category: "냄비", price: 24900,
  //     description: "라면·이유식·1인분 조리용 미니 냄비. 간단 끓이기, 데우기에 적합.",
  //     tags: [] }},
  //
  // { id: 38, payload: { name: "락앤락 편수 냄비", brand: "락앤락", category: "냄비", price: 32900,
  //     description: "한 손 조리용 편수냄비(손잡이 1개). 물 끓이기, 소스/라면 조리에 편함.",
  //     tags: [] }},
  //
  // { id: 39, payload: { name: "락앤락 양수 냄비", brand: "락앤락", category: "냄비", price: 37900,
  //     description: "양손 손잡이 양수냄비. 국물 요리(국/탕/전골), 찜(수육/감자)에도 활용 가능한 냄비.",
  //     tags: [] }},
  //
  // { id: 40, payload: { name: "락앤락 프리미엄 냄비", brand: "락앤락", category: "냄비", price: 89900,
  //     description: "프리미엄 스테인리스 냄비. 고급 마감/내구성, 국/탕/찜 등 메인 냄비로 사용.",
  //     tags: [] }},
  //
  // // 51~70 주방가전
  // { id: 41, payload: { name: "락앤락 전기포트 1.7L", brand: "락앤락", category: "주방소형가전", price: 39900,
  //     description: "1.7L 전기포트/전기주전자. 물 빨리 끓이기, 라면/커피/차용 온수 준비에 사용.",
  //     tags: [] }},
  //
  // { id: 42, payload: { name: "락앤락 토스터기", brand: "락앤락", category: "주방소형가전", price: 45900,
  //     description: "식빵/베이글 토스팅용 토스터기. 아침 간단식, 빵 굽기에 적합.",
  //     tags: [] }},
  //
  // { id: 43, payload: { name: "락앤락 에어프라이어", brand: "락앤락", category: "주방소형가전", price: 129000,
  //     description: "에어프라이어. 기름 없이 튀김/구이 조리, 치킨/감자튀김/냉동식품 간편 조리.",
  //     tags: [] }},
  //
  // { id: 44, payload: { name: "락앤락 블렌더", brand: "락앤락", category: "주방소형가전", price: 99000,
  //     description: "스무디/주스용 블렌더. 과일 갈기, 쉐이크/단백질 음료 만들기.",
  //     tags: [] }},
  //
  // { id: 45, payload: { name: "락앤락 전기밥솥 미니", brand: "락앤락", category: "주방소형가전", price: 119000,
  //     description: "1~2인용 미니 전기밥솥. 자취/신혼 소형 밥솥, 간단 취사 및 보온.",
  //     tags: [] }},
  //
  // { id: 46, payload: { name: "락앤락 전기그릴", brand: "락앤락", category: "주방소형가전", price: 139000,
  //     description: "연기 적은 전기그릴. 고기/생선/야채 굽기, 실내 구이 요리에 적합.",
  //     tags: [] }},
  //
  // { id: 47, payload: { name: "락앤락 커피메이커", brand: "락앤락", category: "주방소형가전", price: 79000,
  //     description: "홈카페용 커피메이커. 드립커피/원두커피 내리기, 아침 커피 루틴용.",
  //     tags: [] }},
  //
  // { id: 48, payload: { name: "락앤락 멀티쿠커", brand: "락앤락", category: "주방소형가전", price: 149000,
  //     description: "찜·조림·탕·죽 등 다용도 조리 가능한 멀티쿠커. 해산물 찜, 만두 찜, 수육 조리에도 활용.",
  //     tags: [] }},
  //
  // { id: 49, payload: { name: "락앤락 전기찜기", brand: "락앤락", category: "주방소형가전", price: 89000,
  //     description: "스팀(증기)으로 찌는 전기찜기. 해산물(조개/새우), 만두, 야채, 계란찜/찐빵 등 찜요리에 사용. '찜통/스티머' 대체로 검색됨.",
  //     tags: [] }},
  //
  // { id: 50, payload: { name: "락앤락 미니 오븐", brand: "락앤락", category: "주방소형가전", price: 159000,
  //     description: "컴팩트 미니 오븐. 베이킹/빵 굽기/오븐구이, 간단 오븐요리에 적합.",
  //     tags: [] }},
  //
  // // 71~100 수납·캠핑·기타
  // { id: 51, payload: { name: "락앤락 쌀통 10kg", brand: "락앤락", category: "수납용품", price: 29900,
  //     description: "10kg 쌀 보관함(쌀통). 습기 차단, 곡물/잡곡 보관 수납용.",
  //     tags: [] }},
  //
  // { id: 52, payload: { name: "락앤락 냉장고 수납 트레이", brand: "락앤락", category: "수납용품", price: 14900,
  //     description: "냉장고 정리용 수납 트레이. 식재료/소스/음료 정리, 냉장고 수납정리에 사용.",
  //     tags: [] }},
  //
  // { id: 53, payload: { name: "락앤락 캠핑 식기 세트", brand: "락앤락", category: "캠핑용품", price: 45900,
  //     description: "야외활동용 캠핑 식기 세트. 접시/그릇/컵 구성으로 피크닉/캠핑 식사에 사용.",
  //     tags: [] }},
  //
  // { id: 54, payload: { name: "락앤락 캠핑 쿨러백", brand: "락앤락", category: "캠핑용품", price: 39900,
  //     description: "보냉 기능 쿨러백. 음식/음료 차갑게 보관, 피크닉/캠핑 아이스백.",
  //     tags: [] }},
  //
  // { id: 55, payload: { name: "락앤락 다용도 수납 박스", brand: "락앤락", category: "수납용품", price: 24900,
  //     description: "주방·거실 다용도 수납박스. 잡동사니/생활용품 정리, 팬트리 수납에 사용.",
  //     tags: [] }},
  //
  // { id: 56, payload: { name: "락앤락 도시락 가방", brand: "락앤락", category: "액세서리", price: 19900,
  //     description: "보온/보냉 도시락 가방. 점심 도시락 들고 다니기, 피크닉 간식 가방으로도 사용.",
  //     tags: [] }},
  //
  // { id: 57, payload: { name: "락앤락 실리콘 조리도구 세트", brand: "락앤락", category: "주방도구", price: 29900,
  //     description: "내열 실리콘 조리도구 세트. 뒤집개/국자 등 구성, 코팅팬에 스크래치 덜 나게 사용하는 주방도구.",
  //     tags: [] }},
  //
  // { id: 58, payload: { name: "락앤락 칼꽂이 세트", brand: "락앤락", category: "주방도구", price: 34900,
  //     description: "주방 칼 정리용 칼꽂이/칼보관 세트. 식칼, 과도 등 칼 수납 정리.",
  //     tags: [] }},
  //
  // { id: 59, payload: { name: "락앤락 도마 세트", brand: "락앤락", category: "주방도구", price: 24900,
  //     description: "위생적인 도마 세트. 채소/고기/생선 손질용으로 구분해서 쓰기 좋고, '도마/커팅보드/칼질판'으로도 검색되는 주방 필수템.",
  //     tags: [] }},
  //
  // { id: 60, payload: { name: "락앤락 실리콘 밀폐팩", brand: "락앤락", category: "밀폐용기", price: 17900,
  //     description: "재사용 가능한 실리콘 밀폐팩. 지퍼백 대체, 식재료/간식 보관, 친환경 보관팩.",
  //     tags: [] }},
];
