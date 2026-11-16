'use client'

import React, { useState } from 'react'
import { Share2, Check, Copy, MessageCircle } from 'lucide-react'

export default function ArticleShareBar({ title, slug }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  const handleWhatsAppShare = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href
      const text = encodeURIComponent(`Check out this article on Crystal Estates: "${title}" - ${url}`)
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
    }
  }

  return (
    <div className="article-share-widget">
      <div className="article-share-widget__label">
        <Share2 size={16} />
        <span>Share this insight:</span>
      </div>
      <div className="article-share-widget__actions">
        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="article-share-btn article-share-btn--whatsapp"
          title="Share via WhatsApp"
        >
          <MessageCircle size={15} />
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className={`article-share-btn article-share-btn--copy ${copied ? 'is-copied' : ''}`}
          title="Copy Article Link"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  )
}
