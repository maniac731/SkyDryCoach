// pages/settings/settings.js
const app = getApp()

Page({
  data: {
    preferenceValue: 5,
    workStart: '08:00',
    workEnd: '19:00',
    location: null,
    preferenceInfo: {
      icon: '⚖️',
      text: '均衡模式：兼顾安全与速度',
      class: 'info-balanced'
    }
  },

  onLoad() {
    console.log('设置页面加载')
    this.loadSettings()
  },

  onShow() {
    // 重新加载设置
    this.loadSettings()
  },

  // 加载设置
  loadSettings() {
    const preferences = wx.getStorageSync('preferences') || app.globalData.preferences
    const location = wx.getStorageSync('location') || app.globalData.location
    
    this.setData({
      preferenceValue: Math.round(preferences.preference * 10),
      workStart: preferences.workStart,
      workEnd: preferences.workEnd,
      location: location
    })
    
    this.updatePreferenceInfo()
  },

  // 偏好设置变化
  onPreferenceChange(e) {
    const value = e.detail.value
    this.setData({
      preferenceValue: value
    })
    this.updatePreferenceInfo()
  },

  // 更新偏好信息显示
  updatePreferenceInfo() {
    const preference = this.data.preferenceValue / 10
    let preferenceInfo
    
    if (preference < 0.3) {
      preferenceInfo = {
        icon: '🛡️',
        text: '安全优先：降低雨天晾衣风险',
        class: 'info-safe'
      }
    } else if (preference > 0.7) {
      preferenceInfo = {
        icon: '⚡',
        text: '速度优先：追求最快干燥时间',
        class: 'info-fast'
      }
    } else {
      preferenceInfo = {
        icon: '⚖️',
        text: '均衡模式：兼顾安全与速度',
        class: 'info-balanced'
      }
    }
    
    this.setData({ preferenceInfo })
  },

  // 工作时间开始变化
  onWorkStartChange(e) {
    this.setData({
      workStart: e.detail.value
    })
  },

  // 工作时间结束变化
  onWorkEndChange(e) {
    this.setData({
      workEnd: e.detail.value
    })
  },

  // 更新位置
  updateLocation() {
    wx.showLoading({
      title: '定位中...',
      mask: true
    })

    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        wx.getLocation({
          type: 'wgs84',
          success: (res) => {
            const location = {
              lat: res.latitude,
              lon: res.longitude,
              address: '当前位置'
            }
            
            this.setData({ location })
            wx.hideLoading()
            
            wx.showToast({
              title: '位置更新成功',
              icon: 'success'
            })
          },
          fail: (err) => {
            console.error('获取位置失败:', err)
            wx.hideLoading()
            wx.showToast({
              title: '获取位置失败',
              icon: 'error'
            })
          }
        })
      },
      fail: (err) => {
        console.error('位置授权失败:', err)
        wx.hideLoading()
        wx.showModal({
          title: '位置授权',
          content: '请授权位置权限以获取准确的天气数据',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      }
    })
  },

  // 保存设置
  saveSettings() {
    const preferences = {
      workStart: this.data.workStart,
      workEnd: this.data.workEnd,
      preference: this.data.preferenceValue / 10
    }

    // 保存到本地存储
    wx.setStorageSync('preferences', preferences)
    
    // 更新全局数据
    app.globalData.preferences = preferences
    
    // 保存位置
    if (this.data.location) {
      wx.setStorageSync('location', this.data.location)
      app.globalData.location = this.data.location
    }

    wx.showToast({
      title: '设置保存成功',
      icon: 'success',
      duration: 2000
    })

    // 延迟返回首页
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  },

  // 恢复默认设置
  resetSettings() {
    wx.showModal({
      title: '确认恢复默认',
      content: '确定要恢复所有设置为默认值吗？',
      success: (res) => {
        if (res.confirm) {
          const defaultPreferences = {
            workStart: '08:00',
            workEnd: '19:00',
            preference: 0.5
          }
          
          this.setData({
            preferenceValue: 5,
            workStart: '08:00',
            workEnd: '19:00'
          })
          
          this.updatePreferenceInfo()
          
          wx.showToast({
            title: '已恢复默认设置',
            icon: 'success'
          })
        }
      }
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack()
  }
})