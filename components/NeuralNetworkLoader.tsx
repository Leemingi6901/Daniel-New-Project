"use client";

import dynamic from "next/dynamic";

const NeuralNetwork3D = dynamic(() => import("@/components/NeuralNetwork3D"), {
  ssr: false,
  loading: () => <div className="nx-network-canvas nx-network-loading" role="img" aria-label="카테고리 네트워크 맵 로딩 중" />,
});

interface CatNode {
  key: string;
  name: string;
  count: number;
}

interface DocNode {
  category: string;
  slug: string;
  title: string;
}

export default function NeuralNetworkLoader({ categories, docs }: { categories: CatNode[]; docs: DocNode[] }) {
  return <NeuralNetwork3D categories={categories} docs={docs} />;
}
