

import React from "react";

interface Props {

  children?: React.ReactNode;

}

export default function GridViewport({ children }: Props) {

  return (

    <div className="flex-1 min-h-0 w-full flex items-center justify-center px-2 py-2 overflow-hidden">

      <div className="
        w-full
        h-full
        max-w-[600px]
        max-h-[600px]
        aspect-square
        flex
        items-center
        justify-center
        relative
      ">

        {children}

      </div>

    </div>

  );

}
