// components/Menu.tsx 또는 네가 보여주는 메뉴 파일
"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/lib/getUser";

export default function Menu() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <div>
      <div>
        {user ? (
          <>
            <div>{user.nickname} 님</div>
            <img
              src={user.profile_image}
              width={50}
              height={50}
              style={{ borderRadius: "50%" }}
            />
          </>
        ) : (
          <div>게스트 님</div>
        )}
      </div>
    </div>
  );
}
